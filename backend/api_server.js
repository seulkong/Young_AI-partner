function parseCSV(csvText) {
    if (!csvText) return [];
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        let values = [];
        let inQuotes = false;
        let currentValue = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { values.push(currentValue); currentValue = ''; }
            else currentValue += char;
        }
        values.push(currentValue);
        const obj = {};
        headers.forEach((h, i) => obj[h] = (values[i] || '').trim().replace(/^"|"$/g, ''));
        return obj;
    });
}

export default {
    async fetch(request, env) {
        const headers = new Headers();
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Content-Type", "application/json");

        const method = request.method;
        const url = new URL(request.url);
        let path = url.pathname;

        if (method === "OPTIONS") return new Response(null, { status: 204, headers });

        try {
            if (path === "/search" && method === "POST") {
                const data = await request.json();
                
                let itemName = (data.item_name || "").trim();
                let userStyle = data.user_style || "health";
                const userStore = data.user_store || "GS25";
                const userTelecom = String(data.user_telecom || "none").toUpperCase().trim();
                const userTelecomTier = String(data.user_telecom_tier || "low").toLowerCase().trim();
                const userIsStudentTelecom = !!data.user_is_student_telecom;
                const userCard = String(data.user_card || "none").trim();
                const userPayment = String(data.user_payment || "none").toLowerCase().trim();

                // 1. 자연어 인식 (검색어에 따른 스타일 오버라이드)
                if (itemName.includes('달달') || itemName.includes('단거') || itemName.includes('달콤') || itemName.includes('차가운')) {
                    userStyle = 'dessert';
                } else if (itemName.includes('건강') || itemName.includes('다이어트') || itemName.includes('살안찌는')) {
                    userStyle = 'health';
                } else if (itemName.includes('매운') || itemName.includes('짭짤') || itemName.includes('매콤')) {
                    userStyle = 'trend';
                }

                // 2. 대학생 혜택 리스트
                if (itemName.includes("대학생") && itemName.includes("혜택")) {
                    let stdMsg = "<strong style='color:#007bff; font-size:1.1em;'>[대학생 편의점 알짜 혜택 리스트]</strong>\n\n";
                    stdMsg += "[통신사 멤버십]\n• SKT: 0청년 요금제 (0 day 50% 할인 쿠폰 등)\n• KT: Y박스 (편의점 1+1 및 모바일 상품권)\n• LG U+: 유쓰(Uth) (20일 유쓰데이 간식 무료, 편의점 10% 할인)\n\n";
                    stdMsg += "[추천 카드]\n• 신한 S20 체크: GS25 7% 캐시백\n• KB국민 노리 체크: 편의점 5% 환급 할인\n• 우리카드 우리V체크: 편의점 추가 적립\n\n";
                    return new Response(JSON.stringify({ type: "result", message: stdMsg, shop: "편의점", saved_amount: 0 }), { headers });
                }

                // 3. SNS 꿀조합 레시피 킬러 콘텐츠
                const recipeKeywords = ['레시피', '꿀조합', '조합', '불닭', '마크정식', '스파게티'];
                if (recipeKeywords.some(kw => itemName.includes(kw))) {
                    let recipeMsg = "<strong style='color:#e74c3c; font-size:1.1em;'>[Young-AI SNS 꿀조합 레시피 추천]</strong>\n\n";
                    if (itemName.includes('불닭')) {
                        recipeMsg += "<strong style='color:#e74c3c;'>[불닭 치즈마요 꿀조합]</strong>\n- 준비물: 불닭볶음면 + 스트링치즈 + 참치마요 삼각김밥\n- 레시피: 불닭을 조리 후 참치마요를 넣고 비빈 다음, 스트링치즈를 찢어 올려 전자레인지 1분!\n- 예상 금액: 약 4,500원 (통신사 할인 시 더 저렴해요!)";
                    } else {
                        recipeMsg += "<strong style='color:#e74c3c;'>[레전드 마크정식]</strong>\n- 준비물: 콕콕콕 스파게티 + 죠스떡볶이 + 소시지바 + 모짜렐라 치즈\n- 레시피: 스파게티와 떡볶이를 각각 조리 후 섞고, 소시지를 잘라 넣은 뒤 치즈를 듬뿍 뿌려 전자레인지 2분!\n- 편의점의 영원한 베스트셀러 레시피입니다. 한 번 꼭 도전해 보세요!";
                    }
                    return new Response(JSON.stringify({ type: "result", message: recipeMsg, shop: "GS25", saved_amount: 0 }), { headers });
                }

                const crawlingRaw = await env.CRAWLING_KV.get("crawling_result.json");
                const crawlingData = crawlingRaw ? JSON.parse(crawlingRaw) : [];

                const recommendKeywords = ['추천', '뭐가', '뭐있어', '보여줘', '핫한', '골라줘', '행사', '세일', '달달', '단거', '매운', '매콤', '건강'];
                const isRecommend = recommendKeywords.some(kw => itemName.includes(kw));
                const searchResults = crawlingData.filter(i => (i.name || '').includes(itemName));
                
                // 완벽하게 일치하는 상품명이 DB에 존재하는지 확인
                const hasExactMatch = crawlingData.some(i => i.name === itemName);
                
                // 4. 추천 리스트 로직 강화 (카테고리 분리 철저)
                // 정확히 일치하는 상품이 있을 경우 추천/리스트 모드를 우회하고 단일 상품 정보 계산으로 바로 갑니다.
                if (!hasExactMatch && (isRecommend || (searchResults.length > 1 && !searchResults.map(i => i.name).includes(itemName)))) {
                    let options = [];
                    // 비식품 배제 철저
                    const excludeKws = ['물티슈', '마스크', '생리대', '콘돔', '가그린', '우산', '종이컵', '건전지', '스타킹', '쏘피', '화이트', '바디피트', '샴푸', '린스', '치약', '칫솔', '비누', '세제', '휴지', '면도기'];
                    
                    if (isRecommend) {
                        const styleKeywords = {
                            'health': ['닭가슴살', '프로틴', '단백질', '제로', '슈거', '샐러드', '견과', '계란', '반숙', '두유', '곤약', '비타민', '생수', '요거트'],
                            'dessert': ['초코', '쿠키', '케이크', '푸딩', '마카롱', '젤리', '구미', '사탕', '캔디', '아이스크림', '달콤', '크림', '파르페'],
                            'brand': ['유어스', '헤이루', '득템', '리얼프라이스', 'PB', '전용', '단독', '도시락'],
                            'trend': ['마라', '요아정', '두바이', '신상', '대란', '인기', '불닭', '치즈', '매운', '크루키']
                        };
                        const kws = styleKeywords[userStyle] || [];
                        crawlingData.forEach(item => {
                            const name = item.name || '';
                            if (excludeKws.some(ex => name.includes(ex))) return;
                            // AND 조건: 카테고리 키워드에 무조건 맞아야 함 (단순 1+1로 포함되는 버그 제거)
                            if (kws.some(k => name.includes(k))) {
                                options.push(item.name);
                            }
                        });
                    } else {
                        // 일반 다중 검색 결과에서도 비식품 필터 옵션
                        options = searchResults.filter(item => !excludeKws.some(ex => (item.name || '').includes(ex))).map(i => i.name);
                    }
                    
                    options = [...new Set(options)].sort(() => 0.5 - Math.random()).slice(0, 15);
                    
                    if (options.length > 0) {
                        let headerMsg = "<strong style='color:#007bff;'>고객님의 취향에 딱 맞는 추천 리스트를 가져왔어요!</strong>";
                        if (isRecommend && userStyle === 'trend') {
                            headerMsg = "<strong style='color:#e74c3c;'>[최근 1주일 SNS 검색량 및 입고 데이터 기준]</strong><br>고객님의 취향에 딱 맞는 핫한 신상 리스트입니다!";
                        }
                        return new Response(JSON.stringify({ type: "list", message: headerMsg, options }), { headers });
                    }
                }

                if (searchResults.length === 0) {
                    return new Response(JSON.stringify({ message: `아쉽게도 '${itemName}' 상품은 현재 행사 중이 아니에요.` }), { headers });
                }
                
                let bestItem = searchResults[0];
                const exactMatch = searchResults.find(i => i.name === itemName);
                if (exactMatch) bestItem = exactMatch;

                const basePrice = parseInt(String(bestItem.price || '0').replace(/,|원/g, '')) || 0;
                const shop = (bestItem.shop || 'GS25').toUpperCase();
                
                let finalPrice = basePrice;
                let discountDetails = [];
                
                const promo = String(bestItem.promotions || '');
                if (promo.includes('1+1')) {
                    finalPrice = basePrice / 2;
                    discountDetails.push(`• <span style="color:#e74c3c; font-weight:bold;">[행사] 1+1 적용</span> (개당 -${Math.floor(basePrice/2).toLocaleString()}원)`);
                } else if (promo.includes('2+1')) {
                    finalPrice = (basePrice * 2) / 3;
                    discountDetails.push(`• <span style="color:#e74c3c; font-weight:bold;">[행사] 2+1 적용</span> (3개 구매 시 개당 -${Math.floor(basePrice/3).toLocaleString()}원)`);
                } else {
                    discountDetails.push("• [행사] 진행 중인 증정 행사 없음");
                }
                
                let telecomApplied = false;
                try {
                    const telecomRaw = await env.CRAWLING_KV.get("Telecom.csv");
                    if (telecomRaw && userTelecom !== 'NONE') {
                        const telRows = parseCSV(telecomRaw);
                        for (const row of telRows) {
                            if ((row.provider || '').toUpperCase() === userTelecom && (row.partner_cvs || '').toUpperCase().includes(shop)) {
                                const isHighTier = ['high', 'vip', 'vvip'].some(t => userTelecomTier.includes(t));
                                const rowTier = (row.tier || '').toUpperCase();
                                let tierMatch = false;
                                if (isHighTier && ['VIP', 'GOLD', 'VVIP'].some(t => rowTier.includes(t))) tierMatch = true;
                                if (!isHighTier && ['SILVER', 'GENERAL', 'NORMAL'].some(t => rowTier.includes(t))) tierMatch = true;
                                
                                if (tierMatch) {
                                    const discRate = parseFloat(row.discount_rate || '0');
                                    const amt = Math.floor(finalPrice * discRate);
                                    finalPrice -= amt;
                                    discountDetails.push(`• <strong style='color:#007bff;'>[통신사] ${userTelecom} ${Math.floor(discRate*100)}% 할인</strong> (-${amt.toLocaleString()}원)`);
                                    telecomApplied = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (userIsStudentTelecom) {
                        if (userTelecom === 'SKT') discountDetails.push("• [대학생] SKT 0청년 멤버십 혜택 (최대 50% 할인 가능)");
                        else if (userTelecom === 'KT') discountDetails.push("• [대학생] KT Y박스 전용 1+1 및 모바일 상품권 혜택");
                        else if (userTelecom === 'LG U+') {
                            const stdAmt = Math.floor(finalPrice * 0.1);
                            finalPrice -= stdAmt;
                            discountDetails.push(`• <strong style='color:#007bff;'>[대학생] LG U+ 유쓰 10% 추가 할인</strong> (-${stdAmt.toLocaleString()}원)`);
                            telecomApplied = true;
                        }
                    }
                } catch (e) {
                    console.error("Telecom error:", e);
                }

                if (!telecomApplied) {
                    if (userTelecom === 'NONE') discountDetails.push("• [통신사] 등록된 멤버십 없음");
                    else discountDetails.push(`• [통신사] ${userTelecom}는 ${shop} 제휴사가 아님`);
                }

                let cardApplied = false;
                const benefitCards = {
                    'GS25': ['삼성', '국민', 'KB', 'GS', '팝', '현대', '롯데', '우리', '하나', 'NH', '농협', '카카오뱅크'],
                    'CU': ['신한', '우리', '하나', '국민', 'KB', '현대', '롯데', 'NH', '농협', '카카오뱅크']
                };
                
                const targetBrandsKws = benefitCards[shop] || [];
                if (targetBrandsKws.some(c => userCard.includes(c))) {
                    const cardDisc = Math.floor(finalPrice * 0.1);
                    finalPrice -= cardDisc;
                    discountDetails.push(`• <strong style='color:#28a745;'>[카드] ${userCard} 제휴 약 10% 할인</strong> (-${cardDisc.toLocaleString()}원)`);
                    cardApplied = true;
                } else {
                    if (userCard !== 'none') discountDetails.push(`• [카드] ${userCard}는 ${shop} 제휴 혜택을 찾지 못했어요.`);
                    else discountDetails.push(`• [카드] 등록된 카드 없음`);
                }

                let studentCardApplied = false;
                if (userCard.includes("신한 S20 체크") && shop === "GS25") {
                    const stdCardDisc = Math.floor(finalPrice * 0.07);
                    finalPrice -= stdCardDisc;
                    discountDetails.push(`• <strong style='color:#28a745;'>[대학생] ${userCard} GS25 7% 캐시백</strong> (-${stdCardDisc.toLocaleString()}원)`);
                    studentCardApplied = true;
                } else if (userCard.includes("우리V체크")) {
                    discountDetails.push(`• <strong style='color:#28a745;'>[대학생] ${userCard} 편의점 추가 적립</strong>`);
                    studentCardApplied = true;
                }

                let cardRecommendation = "";
                let studentRecommendations = [];
                let tips = [];
                if (!userIsStudentTelecom) {
                    if (userTelecom === 'SKT') studentRecommendations.push("SKT 0청년");
                    else if (userTelecom === 'KT') studentRecommendations.push("KT Y(Y박스)");
                    else if (userTelecom === 'LG U+') studentRecommendations.push("LG U+ 유쓰");
                }
                if (!studentCardApplied) {
                    if (shop === "GS25") studentRecommendations.push("신한 S20 체크(GS25 7% 할인)");
                    studentRecommendations.push("우리카드 우리V체크");
                }
                if (studentRecommendations.length > 0) {
                    cardRecommendation += `<strong style="color: #4F46E5;">[안내]</strong> 대학생이신가요? ${studentRecommendations.slice(0, 2).join(', ')}을 사용하시면 더 큰 혜택을 받을 수 있어요!\n`;
                    tips.push({
                        type: "student",
                        badge: "대학생 혜택",
                        text: `대학생이신가요? ${studentRecommendations.slice(0, 2).join(', ')}을 사용하시면 더 큰 혜택을 받을 수 있어요!`
                    });
                }

                let paymentApplied = false;
                if (shop === "CU") {
                    if (userPayment.includes("naver")) {
                        const naverDisc = Math.floor(finalPrice * 0.05);
                        finalPrice -= naverDisc;
                        discountDetails.push(`• <strong style='color:#10b981;'>[간편결제] 네이버페이(네이버플러스멤버십 연동) 5% 추가 할인 + 5% 즉시 적립</strong> (-${naverDisc.toLocaleString()}원)`);
                        paymentApplied = true;
                        tips.push({
                            type: "payment",
                            badge: "간편결제 혜택",
                            text: "네이버플러스멤버십 회원이라면 CU멤버십 연동 후 네이버페이로 결제 시 1일 1회 최대 10% 혜택(5%할인+5%적립)을 받을 수 있어요!"
                        });
                    } else if (userPayment.includes("kakao")) {
                        const kakaoDisc = Math.floor(finalPrice * 0.05);
                        finalPrice -= kakaoDisc;
                        discountDetails.push(`• <strong style='color:#f59e0b;'>[간편결제] 카카오페이(CU멤버십 연동) 5% 추가 할인 + 5% 적립</strong> (-${kakaoDisc.toLocaleString()}원)`);
                        paymentApplied = true;
                        tips.push({
                            type: "payment",
                            badge: "간편결제 혜택",
                            text: "카카오페이 앱에서 CU멤버십을 연동하고 결제하면 매일 최대 10% 혜택(5%할인+5%적립)을 받을 수 있어요!"
                        });
                    }
                }
                
                if (!paymentApplied) {
                     if (userPayment !== 'none' && userPayment !== '') {
                         discountDetails.push(`• [간편결제] 특별 추가 혜택 없음`);
                     } else {
                         discountDetails.push(`• [간편결제] 등록된 결제수단 없음`);
                     }
                }

                if (!cardApplied && !studentCardApplied) {
                    try {
                        const cardCsvRaw = await env.CRAWLING_KV.get("Card.csv");
                        if (cardCsvRaw) {
                            const cardRows = parseCSV(cardCsvRaw);
                            for (const row of cardRows) {
                                const targetBrands = row.Target_Brands || '';
                                if (targetBrands.includes(shop) || targetBrands.includes('주요 편의점')) {
                                    const benefit = row.Benefit_Details || '할인 혜택';
                                    cardRecommendation += `\n<strong style="color: #e67e22;">[${shop} 결제 팁]</strong> '${row.Card_Name}' (${row.Issuer})를 쓰시면 ${benefit} 혜택을 받을 수 있어요!`;
                                    tips.push({
                                        type: "card",
                                        badge: `${shop} 결제 팁`,
                                        text: `'${row.Card_Name}' (${row.Issuer})를 쓰시면 ${benefit} 혜택을 받을 수 있어요!`
                                    });
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Card error:", e);
                    }
                } // 누락된 닫는 중괄호 추가
                // 간편결제(페이) 맞춤형 혜택 안내 (다중 선택 대응)
                let paymentRecommendation = "";
                if (userPayment.includes("naver")) {
                    paymentRecommendation += `\n<strong style='color:#03c75a;'>[네이버페이 결제 꿀팁]</strong> 네이버플러스 멤버십 현장 결제 시 최대 5% 추가 적립!`;
                    tips.push({
                        type: "payment",
                        badge: "네이버페이 꿀팁",
                        text: "네이버플러스 멤버십 현장 결제 시 최대 5% 추가 적립!"
                    });
                }
                if (userPayment.includes("kakao")) {
                    paymentRecommendation += `\n<strong style='color:#FFCD00;'>[카카오페이 결제 꿀팁]</strong> 현장 결제 시 랜덤 '알' 리워드 지급!`;
                    tips.push({
                        type: "payment",
                        badge: "카카오페이 꿀팁",
                        text: "현장 결제 시 랜덤 '알' 리워드 지급!"
                    });
                }
                if (userPayment.includes("toss")) {
                    paymentRecommendation += `\n<strong style='color:#3182f6;'>[토스페이 결제 꿀팁]</strong> 결제 시 매일 달라지는 브랜드 캐시백 혜택!`;
                    tips.push({
                        type: "payment",
                        badge: "토스페이 꿀팁",
                        text: "결제 시 매일 달라지는 브랜드 캐시백 혜택!"
                    });
                }
                if (!userPayment.includes("naver") && !userPayment.includes("kakao") && !userPayment.includes("toss")) {
                    paymentRecommendation = `\n<strong style='color:#4F46E5;'>[간편결제 팁]</strong> 네이버페이, 카카오페이 등 간편결제로 현장 뽑기 포인트 혜택을 추가로 받아보세요!`;
                    tips.push({
                        type: "payment",
                        badge: "간편결제 팁",
                        text: "네이버페이, 카카오페이 등 간편결제로 현장 뽑기 포인트 혜택을 추가로 받아보세요!"
                    });
                }
                
                cardRecommendation += paymentRecommendation;

                const favoriteStore = data.favorite_store;
                let msg = '';
                if (favoriteStore && favoriteStore.toUpperCase().includes(shop)) {
                    msg = `<strong>'${bestItem.name}'</strong> 상품이 단골 매장인 <strong>${favoriteStore}</strong>에서 혜택이 적용됩니다!\n`;
                } else {
                    msg = `<strong>'${bestItem.name}' (${shop})</strong> 최적의 할인 조합입니다!\n`;
                    if (userStore !== 'none' && userStore.toUpperCase() !== shop.toUpperCase()) {
                        msg += `[추천 알림] 선호하시는 ${userStore}보다 ${shop}에서 더 좋은 혜택이 있어 추천해 드려요!\n`;
                    }
                }
                msg += `\n기본 가격: <del>${basePrice.toLocaleString()}원</del>\n`;
                if (discountDetails.length > 0) {
                    msg += `\n[적용된 할인 혜택]\n${discountDetails.join('\n')}\n`;
                }
                msg += `\n<strong style='font-size:1.2em; color:#e74c3c;'>[최종 혜택가: ${Math.floor(finalPrice).toLocaleString()}원]</strong>`;
                if (cardRecommendation) msg += `\n\n${cardRecommendation}`;

                let fetchedImgUrl = '';
                try {
                    const searchUrl = `https://xn--vf4b15j1pa468argc.com/ajax.item_list.php?mode=list&serche_text=${encodeURIComponent(bestItem.name)}`;
                    const imgRes = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                    const htmlText = await imgRes.text();
                    const imgMatch = htmlText.match(/<div class="item_img">\s*<img src="([^"]+)"/i);
                    if (imgMatch && imgMatch[1]) {
                        fetchedImgUrl = imgMatch[1];
                    }
                } catch(e) {
                    console.error("Failed to fetch image for chat result", bestItem.name);
                }

                return new Response(JSON.stringify({
                    type: "result",
                    message: msg,
                    shop: shop,
                    saved_amount: Math.floor(basePrice - finalPrice),
                    itemName: bestItem.name,
                    imgUrl: fetchedImgUrl,
                    basePrice: basePrice,
                    finalPrice: Math.floor(finalPrice),
                    discountDetails: discountDetails,
                    cardRecommendation: cardRecommendation,
                    tips: tips
                }), { headers });

            } else if (path === "/api/signup" && method === "POST") {
                const data = await request.json();
                await env.DB.prepare("INSERT INTO users (id, name, style) VALUES (?, ?, ?)").bind(data.id, data.name, data.style).run();
                return new Response(JSON.stringify({ message: "OK" }), { headers });

            } else if (path === "/api/login" && method === "POST") {
                const data = await request.json();
                const result = await env.DB.prepare("SELECT id, name, style, store, carrier FROM users WHERE id = ?").bind(data.id).first();
                if (result) {
                    return new Response(JSON.stringify({ message: "OK", user: result }), { headers });
                }
                return new Response(JSON.stringify({ error: "User not found" }), { status: 401, headers });

            } else if (path === "/api/survey" && method === "POST") {
                const data = await request.json();
                await env.DB.prepare("UPDATE users SET store = ?, carrier = ? WHERE id = ?").bind(data.store, data.carrier, data.id).run();
                return new Response(JSON.stringify({ message: "OK" }), { headers });

            } else if (path === "/api/curation" && method === "POST") {
                const data = await request.json();
                const userStyle = data.userStyle || "trend";
                const userStore = data.userStore || "none";
                
                const crawlingRaw = await env.CRAWLING_KV.get("crawling_result.json");
                const crawlingData = crawlingRaw ? JSON.parse(crawlingRaw) : [];
                
                let matchingItems = [];
                const excludeKws = ['물티슈', '마스크', '생리대', '콘돔', '가그린', '우산', '종이컵', '건전지', '스타킹', '쏘피', '화이트', '바디피트', '샴푸', '린스', '치약', '칫솔', '비누', '세제', '휴지', '면도기'];
                const styleKeywords = {
                    'health': ['닭가슴살', '프로틴', '단백질', '제로', '슈거', '샐러드', '견과', '계란', '반숙', '두유', '곤약', '비타민', '생수', '요거트'],
                    'dessert': ['초코', '쿠키', '케이크', '푸딩', '마카롱', '젤리', '구미', '사탕', '캔디', '아이스크림', '달콤', '크림', '파르페'],
                    'brand': ['유어스', '헤이루', '득템', '리얼프라이스', 'PB', '전용', '단독', '도시락'],
                    'trend': ['마라', '요아정', '두바이', '신상', '대란', '인기', '불닭', '치즈', '매운', '크루키']
                };
                
                const kws = styleKeywords[userStyle] || styleKeywords['trend'];
                crawlingData.forEach(item => {
                    const name = item.name || '';
                    if (excludeKws.some(ex => name.includes(ex))) return;
                    
                    // Filter by nearest/preferred store if one is selected
                    if (userStore !== "none" && item.shop) {
                        if (!item.shop.toUpperCase().includes(userStore.toUpperCase())) return;
                    }
                    
                    if (kws.some(k => name.includes(k))) {
                        matchingItems.push(item);
                    }
                });
                
                // 중복 제거 후 섞기
                const uniqueMap = new Map();
                matchingItems.forEach(i => uniqueMap.set(i.name, i));
                matchingItems = Array.from(uniqueMap.values());
                matchingItems = matchingItems.sort(() => 0.5 - Math.random()).slice(0, 6);
                
                // 고화질 SVG 아이콘 세트
                const svgs = {
                    health: [
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 22l10-10"/></svg>', // Leaf
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' // Heart
                    ],
                    dessert: [
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>', // Coffee
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' // Smile
                    ],
                    trend: [
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>', // Flame
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' // Star
                    ],
                    brand: [
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', // Store
                        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' // Tag
                    ]
                };
                
                const svgSet = svgs[userStyle] || svgs['trend'];
                
                const resultItems = [];
                for (let i = 0; i < matchingItems.length; i++) {
                    const item = matchingItems[i];
                    let imgHtml = svgSet[Math.floor(Math.random() * svgSet.length)];
                    
                    try {
                        const searchUrl = `https://xn--vf4b15j1pa468argc.com/ajax.item_list.php?mode=list&serche_text=${encodeURIComponent(item.name)}`;
                        const imgRes = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                        const htmlText = await imgRes.text();
                        
                        // 정규식으로 item_img 클래스 안의 img src 추출
                        const imgMatch = htmlText.match(/<div class="item_img">\s*<img src="([^"]+)"/i);
                        if (imgMatch && imgMatch[1]) {
                            imgHtml = `<img src="${imgMatch[1]}" style="width: 70px; height: 70px; object-fit: contain; border-radius: 8px;">`;
                        }
                    } catch(e) {
                        console.error("Failed to fetch image for", item.name);
                    }
                    
                    // 추천 멘트 생성
                    let comment = "요즘 제일 잘나가는 픽!";
                    if (userStyle === 'health') comment = "부담 없이 가볍게 즐겨요";
                    else if (userStyle === 'dessert') comment = "당 충전이 필요할 때 딱!";
                    else if (userStyle === 'trend') comment = "요즘 제일 잘나가는 픽!";
                    
                    if (item.name.includes('1+1') || (item.promotions && item.promotions.includes('1+1'))) comment = "1+1 행사로 쟁여두기 필수!";
                    if (item.name.includes('단백질') || item.name.includes('프로틴')) comment = "단백질 든든하게 채우세요";
                    
                    resultItems.push({
                        name: item.name,
                        badge: String(item.promotions || "HOT").split(',')[0].trim(),
                        desc: item.shop || "편의점",
                        comment: comment,
                        img: imgHtml,
                        price: item.price || "가격 변동"
                    });
                }
                
                return new Response(JSON.stringify({ items: resultItems }), { headers });

            } else if (path === "/api/scan" && method === "POST") {
                const data = await request.json();
                const filename = (data.filename || "").toLowerCase();
                
                let mockMessage = "";
                
                if (filename.includes("우유") || filename.includes("밀크")) {
                    mockMessage = "[Vision AI 스캔 완료!]\n\n• 품목: 서울우유 1L (2,800원)\n\n[Young-AI 사후 분석 피드백]\n우유를 구매하셨네요! 이번 주 근처 GS25에서 '연세우유' 라인업이 2+1 행사 중입니다. 매일 우유를 드신다면 대량 구매 혜택이 더 유리해요!";
                } else if (filename.includes("도시락") || filename.includes("김밥")) {
                    mockMessage = "[Vision AI 스캔 완료!]\n\n• 품목: 참치마요 삼각김밥 (1,200원)\n\n[Young-AI 사후 분석 피드백]\n식사 대용품을 구매하셨군요! 결제하신 금액을 보니, 현재 통신사 학생 멤버십(0청년 등) 할인을 적용하지 않으신 것 같아요. 다음 결제 땐 바코드 제시 잊지 마세요!";
                } else if (filename.includes("맥주") || filename.includes("소주")) {
                    mockMessage = "[Vision AI 스캔 완료!]\n\n• 품목: 카스 500ml 1캔 (2,800원)\n\n[Young-AI 사후 분석 피드백]\n편의점 주류는 낱개보다 '4캔 11,000원'이나 번들 행사를 활용하시는 게 압도적으로 저렴합니다! 이번 주 CU에서 인기 맥주 번들 할인 행사를 진행 중이니 확인해 보세요!";
                } else {
                    const scenarios = [
                        "[Vision AI 스캔 완료!]\n\n• 품목: 오레오씬즈화이트 (2,000원)\n\n[Young-AI 사후 분석 피드백]\n앗! 등록하신 '멤버십' 바코드를 제시하셨다면 200원을 아낄 수 있었어요. 게다가 이 품목은 현재 근처 편의점에서 **1+1 행사** 중이네요!",
                        "[Vision AI 스캔 완료!]\n\n• 품목: 칠성사이다 제로 500ml (2,200원)\n\n[Young-AI 사후 분석 피드백]\n탄산음료 구매 시 네이버페이로 결제하시면 이번 달 10% 추가 적립 이벤트가 있어요! 다음엔 챗봇이 알려드린 간편결제 팁을 꼭 활용해 보세요!",
                        "[Vision AI 스캔 완료!]\n\n• 품목: 더건강식단 닭가슴살 (3,500원)\n\n[Young-AI 사후 분석 피드백]\n건강한 단백질 식단을 구매하셨네요! 해당 상품은 현재 타 편의점 브랜드에서 2+1 교차 증정 행사를 진행하고 있습니다. 다음 결제 전엔 저에게 먼저 물어봐 주세요!"
                    ];
                    mockMessage = scenarios[Math.floor(Math.random() * scenarios.length)];
                }
                
                return new Response(JSON.stringify({ message: mockMessage }), { headers });
            }

            return new Response("Not Found", { status: 404, headers });

        } catch (e) {
            console.error(e);
            return new Response(JSON.stringify({ error: String(e), stack: e.stack }), { status: 500, headers });
        }
    }
};
