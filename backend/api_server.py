import json
import csv
import io
from js import Response, Headers, Object

async def on_fetch(request, env):
    # CORS 헤더 설정
    headers = Headers.new()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "*")
    headers.set("Content-Type", "application/json")
    
    method = request.method
    url = request.url
    path = "/" + "/".join(url.split("/")[3:])
    if "?" in path: path = path.split("?")[0]

    if method == "OPTIONS":
        return Response.new("", status=204, headers=headers)

    try:
        if path == "/search" and method == "POST":
            js_data = await request.json()
            data = js_data.to_py()
            
            item_name = data.get("item_name", "").strip()
            user_style = data.get("user_style", "health")
            user_store = data.get("user_store", "GS25")
            user_telecom = str(data.get("user_telecom", "none")).upper().strip()
            user_telecom_tier = str(data.get("user_telecom_tier", "low")).lower().strip()
            user_is_student_telecom = data.get("user_is_student_telecom", False)
            user_card = str(data.get("user_card", "none")).strip()

            # 대학생 전용 혜택 리스트업 로직
            if "대학생" in item_name and "혜택" in item_name:
                std_msg = "🎓 **대학생이라면 꼭 챙겨야 할 편의점 알짜 혜택 리스트!**\n\n"
                std_msg += "[통신사 멤버십]\n"
                std_msg += "• SKT: 0청년 요금제 (0 day 50% 할인 쿠폰 등)\n"
                std_msg += "• KT: Y박스 (편의점 1+1 및 모바일 상품권)\n"
                std_msg += "• LG U+: 유쓰(Uth) (20일 유쓰데이 간식 무료, 편의점 10% 할인)\n\n"
                std_msg += "[추천 카드]\n"
                std_msg += "• 신한 S20 체크: GS25 7% 캐시백\n"
                std_msg += "• KB국민 노리 체크: 편의점 5% 환급 할인\n"
                std_msg += "• 우리카드 우리V체크: 편의점 추가 적립\n\n"
                return Response.new(json.dumps({"type": "result", "message": std_msg, "shop": "편의점"}), headers=headers)

            crawling_raw = await env.CRAWLING_KV.get("crawling_result.json")
            crawling_data = json.loads(crawling_raw) if crawling_raw else []

            recommend_keywords = ['추천', '뭐가', '뭐있어', '보여줘', '핫한', '골라줘', '행사', '세일']
            is_recommend = any(kw in item_name for kw in recommend_keywords)
            search_results = [i for i in crawling_data if item_name in i.get('name', '')]
            
            # 리스트 응답
            if is_recommend or (len(search_results) > 1 and item_name not in [i['name'] for i in search_results]):
                options = []
                exclude_kws = ['쏘피', '화이트', '바디피트', '샴푸', '린스', '치약', '칫솔', '비누', '세제', '휴지', '건전지']
                
                if is_recommend:
                    style_keywords = {
                        'health': ['닭가슴살', '프로틴', '단백질', '제로', '슈거', '샐러드', '견과', '계란', '반숙', '두유', '곤약', '비타민', '생수'],
                        'dessert': ['초코', '쿠키', '케이크', '푸딩', '마카롱', '젤리', '구미', '사탕', '캔디', '아이스크림', '달콤'],
                        'brand': ['유어스', '헤이루', '득템', '리얼프라이스', 'PB', '전용', '차별화', '단독'],
                        'trend': ['마라', '요아정', '두바이', '신상', '대란', '인기', '불닭', '치즈']
                    }
                    kws = style_keywords.get(user_style, [])
                    for item in crawling_data:
                        name = item.get('name', '')
                        if any(ex in name for ex in exclude_kws): continue
                        if any(k in name for k in kws) or ('1+1' in str(item.get('promotions', ''))):
                             options.append(item.get('name'))
                else:
                    options = [i['name'] for i in search_results]
                
                import random
                options = list(dict.fromkeys(options))
                random.shuffle(options)
                options = options[:15]
                
                if options:
                    return Response.new(json.dumps({"type": "list", "message": "고객님의 스타일에 딱 맞는 추천 리스트를 가져왔어요! ✨", "options": options}), headers=headers)

            # 단일 상품 응답
            if not search_results:
                return Response.new(json.dumps({"message": f"아쉽게도 '{item_name}' 상품은 현재 행사 중이 아니에요."}), headers=headers)
            
            best_item = search_results[0]
            exact_match = [i for i in search_results if i['name'] == item_name]
            if exact_match: best_item = exact_match[0]

            base_price = int(str(best_item.get('price', '0')).replace(',', '').replace('원', ''))
            shop = best_item.get('shop', 'GS25').upper()
            
            final_price = base_price
            discount_details = []
            
            promo = str(best_item.get('promotions', ''))
            if '1+1' in promo:
                final_price = base_price / 2
                discount_details.append(f"• [행사] 1+1 적용 (개당 -{int(base_price/2):,}원)")
            elif '2+1' in promo:
                final_price = (base_price * 2) / 3
                discount_details.append(f"• [행사] 2+1 적용 (3개 구매 시 개당 -{int(base_price/3):,}원)")
            else:
                discount_details.append("• [행사] 진행 중인 증정 행사 없음")
            
            telecom_applied = False
            try:
                telecom_raw = await env.CRAWLING_KV.get("Telecom.csv")
                if telecom_raw and user_telecom != 'NONE':
                    if telecom_raw.startswith('\ufeff'): telecom_raw = telecom_raw[1:]
                    f = io.StringIO(telecom_raw)
                    tel_reader = csv.DictReader(f)
                    for row in tel_reader:
                        row = {k.strip(): v for k, v in row.items() if k}
                        # provider: SKT, KT, LG U+
                        # partner_cvs: GS25, CU, 7-Eleven
                        if row.get('provider', '').upper() == user_telecom and shop in row.get('partner_cvs', '').upper():
                            is_high_tier = 'high' in user_telecom_tier or 'vip' in user_telecom_tier or 'vvip' in user_telecom_tier
                            row_tier = row.get('tier', '').upper()
                            tier_match = False
                            if is_high_tier and any(t in row_tier for t in ['VIP', 'GOLD', 'VVIP']): tier_match = True
                            if not is_high_tier and any(t in row_tier for t in ['SILVER', 'GENERAL', 'NORMAL']): tier_match = True
                            
                            if tier_match:
                                disc_rate = float(row.get('discount_rate', '0'))
                                amt = int(final_price * disc_rate)
                                final_price -= amt
                                discount_details.append(f"• [통신사] {user_telecom} 멤버십 {int(disc_rate*100)}% 할인 (-{amt:,}원)")
                                telecom_applied = True
                                break
                
                # 대학생 전용 멤버십 추가 혜택 (가정: 대학생 타겟 서비스이므로 추가 적용)
                if user_is_student_telecom:
                    if user_telecom == 'SKT':
                        # 0청년 (50% 할인 쿠폰 등)
                        discount_details.append("• [대학생] SKT 0청년 멤버십 혜택 (최대 50% 할인 가능)")
                    elif user_telecom == 'KT':
                        # Y박스 (1+1 등)
                        discount_details.append("• [대학생] KT Y박스 전용 1+1 및 모바일 상품권 혜택")
                    elif user_telecom == 'LG U+':
                        # 유쓰 (10% 할인)
                        std_amt = int(final_price * 0.1)
                        final_price -= std_amt
                        discount_details.append(f"• [대학생] LG U+ 유쓰(Uth) 10% 추가 할인 (-{std_amt:,}원)")
                        telecom_applied = True
            except Exception as e:
                print(f"Telecom error: {e}")

            if not telecom_applied:
                if user_telecom == 'NONE': discount_details.append("• [통신사] 등록된 멤버십 없음")
                else: discount_details.append(f"• [통신사] {user_telecom}는 {shop} 제휴사가 아님")

            card_applied = False
            # 제휴 카드사 키워드 확대
            benefit_cards = {
                'GS25': ['삼성', '국민', 'KB', 'GS', '팝', '현대', '롯데', '우리', '하나', 'NH', '농협', '카카오뱅크'],
                'CU': ['신한', '우리', '하나', '국민', 'KB', '현대', '롯데', 'NH', '농협', '카카오뱅크']
            }
            
            target_brands_kws = benefit_cards.get(shop, [])
            if any(c in user_card for c in target_brands_kws):
                card_disc = int(final_price * 0.1) # 기본 10% 가정
                final_price -= card_disc
                discount_details.append(f"• [카드] {user_card} 제휴 약 10% 추가 할인 (-{card_disc:,}원)")
                card_applied = True
            else:
                if user_card != 'none':
                    discount_details.append(f"• [카드] {user_card}는 {shop} 제휴 혜택을 찾지 못했어요.")
                else:
                    discount_details.append(f"• [카드] 등록된 카드 없음")

            # 대학생 전용 카드 혜택 추가 적용
            student_card_applied = False
            if "신한 S20 체크" in user_card and shop == "GS25":
                std_card_disc = int(final_price * 0.07)
                final_price -= std_card_disc
                discount_details.append(f"• [대학생] {user_card} GS25 7% 캐시백 혜택 (-{std_card_disc:,}원)")
                student_card_applied = True
            elif "우리V체크" in user_card:
                discount_details.append(f"• [대학생] {user_card} 편의점 추가 적립 혜택 적용")
                student_card_applied = True

            card_recommendation = ""
            # 대학생용 카드/멤버십 추천 멘트 생성 (대학생 가정)
            student_recommendations = []
            if not user_is_student_telecom:
                if user_telecom == 'SKT': student_recommendations.append("SKT 0청년")
                elif user_telecom == 'KT': student_recommendations.append("KT Y(Y박스)")
                elif user_telecom == 'LG U+': student_recommendations.append("LG U+ 유쓰")
            
            if not student_card_applied:
                if shop == "GS25": student_recommendations.append("신한 S20 체크(GS25 7% 할인)")
                student_recommendations.append("우리카드 우리V체크")

            if student_recommendations:
                card_recommendation += f"🎓 대학생이신가요? {', '.join(student_recommendations[:2])}을 사용하시면 더 큰 혜택을 받을 수 있어요!\n"

            if not card_applied and not student_card_applied:
                try:
                    card_csv_raw = await env.CRAWLING_KV.get("Card.csv")
                    if card_csv_raw:
                        if card_csv_raw.startswith('\ufeff'): card_csv_raw = card_csv_raw[1:]
                        f = io.StringIO(card_csv_raw)
                        card_reader = csv.DictReader(f)
                        for row in card_reader:
                            row = {k.strip(): v for k, v in row.items() if k}
                            target_brands = row.get('Target_Brands', '')
                            # 해당 편의점 브랜드 혹은 '주요 편의점' 포함 여부 확인
                            if shop in target_brands or '주요 편의점' in target_brands:
                                benefit = row.get('Benefit_Details', '할인 혜택')
                                card_recommendation += f"\n💡 {shop} 꿀팁! '{row.get('Card_Name')}' ({row.get('Issuer')})를 쓰시면 {benefit} 혜택을 받을 수 있어요!"
                                break
                except Exception as e:
                    print(f"Card error: {e}")

            msg = f"'{best_item['name']}' ({shop}) 최적의 할인 조합입니다!\n"
            
            # 선호 편의점과 결과 편의점이 다를 경우 안내 멘트 추가
            if user_store != 'none' and user_store.upper() != shop.upper():
                msg += f"💡 선호하시는 {user_store}보다 {shop}에서 더 좋은 혜택이 있어 추천해 드려요!\n"
            
            msg += "\n"
            msg += f"기본 가격: {base_price:,}원\n"
            if discount_details:
                msg += "\n[적용된 할인 혜택]\n" + "\n".join(discount_details) + "\n"
            msg += f"\n✨ 최종 혜택가: {int(final_price):,}원"
            if card_recommendation: msg += "\n" + card_recommendation

            return Response.new(json.dumps({
                "type": "result",
                "message": msg,
                "shop": shop 
            }), headers=headers)

        elif path == "/api/signup" and method == "POST":
            js_data = await request.json()
            data = js_data.to_py()
            user_id, name, style = data.get("id"), data.get("name"), data.get("style")
            await env.DB.prepare("INSERT INTO users (id, name, style) VALUES (?, ?, ?)").bind(user_id, name, style).run()
            return Response.new(json.dumps({"message": "OK"}), headers=headers)

        elif path == "/api/login" and method == "POST":
            js_data = await request.json()
            data = js_data.to_py()
            user_id = data.get("id")
            result = await env.DB.prepare("SELECT id, name, style, store, carrier FROM users WHERE id = ?").bind(user_id).first()
            if result:
                user_dict = result.to_py() if hasattr(result, "to_py") else dict(result)
                return Response.new(json.dumps({"message": "OK", "user": user_dict}), headers=headers)
            return Response.new(json.dumps({"error": "User not found"}), status=401, headers=headers)

        elif path == "/api/survey" and method == "POST":
            js_data = await request.json()
            data = js_data.to_py()
            user_id, store, carrier = data.get("id"), data.get("store"), data.get("carrier")
            await env.DB.prepare("UPDATE users SET store = ?, carrier = ? WHERE id = ?").bind(store, carrier, user_id).run()
            return Response.new(json.dumps({"message": "OK"}), headers=headers)

        return Response.new("Not Found", status=404, headers=headers)

    except Exception as e:
        import traceback
        return Response.new(json.dumps({"error": str(e), "traceback": traceback.format_exc()}), status=500, headers=headers)