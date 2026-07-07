// --- 대시보드 로직 ---
let savingChartInstance = null;
let lastSavedTotal = 0;

function animateCounter(elementId, start, end, duration = 1200) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
        obj.innerText = Math.floor(easeProgress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerText = end.toLocaleString();
        }
    };
    window.requestAnimationFrame(step);
}

function updateDashboard(currentTotal) {
    const totalSavedEl = document.getElementById('totalSavedAmount');
    if (totalSavedEl) {
        animateCounter('totalSavedAmount', lastSavedTotal, currentTotal, 1200);
        lastSavedTotal = currentTotal;
    }
    
    // 뱃지 업데이트
    const badgeEl = document.getElementById('savingBadge');
    if (badgeEl) {
        if (currentTotal > 50000) {
            badgeEl.innerHTML = '축하합니다! 상위 1% 스마트 컨슈머입니다!';
        } else if (currentTotal > 10000) {
            badgeEl.innerHTML = '아주 훌륭해요! 상위 10% 스마트 컨슈머입니다!';
        } else {
            badgeEl.innerHTML = '조금 더 모아서 상위 10% 스마트 컨슈머가 되어보세요!';
        }
    }

    // 차트 업데이트 (최근 4번의 가상 소비 기록 + 오늘 누적)
    const ctx = document.getElementById('savingChart');
    if (ctx && typeof Chart !== 'undefined') {
        if (savingChartInstance) {
            savingChartInstance.destroy();
        }
        savingChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1주차', '2주차', '3주차', '4주차', '이번 달 총합'],
                datasets: [{
                    label: '절약 금액 (원)',
                    data: [1500, 3200, 2100, 4000, currentTotal],
                    backgroundColor: [
                        'rgba(201, 203, 207, 0.5)',
                        'rgba(201, 203, 207, 0.5)',
                        'rgba(201, 203, 207, 0.5)',
                        'rgba(201, 203, 207, 0.5)',
                        'rgba(40, 167, 69, 0.7)'
                    ],
                    borderColor: [
                        'rgb(201, 203, 207)',
                        'rgb(201, 203, 207)',
                        'rgb(201, 203, 207)',
                        'rgb(201, 203, 207)',
                        'rgb(40, 167, 69)'
                    ],
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// 사용자 위치 가져오기
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                fetchNearbyStores(latitude, longitude);
            },
            (error) => {
                console.warn("위치 정보를 가져오는 데 실패했습니다.", error);
                // 실패 시 기본 위치(종로구) 사용
                fetchNearbyStores(37.5700, 126.9796);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } else {
        fetchNearbyStores(37.5700, 126.9796);
    }
}

// 근처 편의점 목록 가져오기
async function fetchNearbyStores(latitude, longitude) {
    const REST_API_KEY = '28927acb4f3229bf2bddf11261cc6ff3';
    try {
        const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CS2&x=${longitude}&y=${latitude}&radius=1000&sort=distance`;
        const response = await fetch(url, { headers: { 'Authorization': `KakaoAK ${REST_API_KEY}` } });
        
        if (!response.ok) throw new Error('API 요청 실패');
        
        const data = await response.json();
        
        const gs25List = document.getElementById('gs25-list');
        const cuList = document.getElementById('cu-list');
        if (gs25List) gs25List.innerHTML = '';
        if (cuList) cuList.innerHTML = '';
 
        if (data && data.documents) {
            window.nearestGS25 = null;
            window.nearestCU = null;
            window.lastSearchedPlaces = data.documents;
            data.documents.forEach(place => {
                const name = place.place_name.toUpperCase();
                if (name.includes('GS25') && gs25List) {
                    if (!window.nearestGS25) window.nearestGS25 = place.place_name;
                    displayPlace(place, gs25List, null);
                } else if (name.includes('CU') && cuList) {
                    if (!window.nearestCU) window.nearestCU = place.place_name;
                    displayPlace(place, cuList, null);
                }
            });
            
            if (gs25List && gs25List.children.length === 0) gs25List.innerHTML = '<li>주변에 GS25가 없습니다.</li>';
            if (cuList && cuList.children.length === 0) cuList.innerHTML = '<li>주변에 CU가 없습니다.</li>';
        }
    } catch (error) {
        console.error("편의점 정보를 가져오는 데 실패했습니다.", error);
    }
}

window.toggleFavoriteStore = function(placeName, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    let favStore = localStorage.getItem('favoriteStore');
    if (favStore === placeName) {
        localStorage.removeItem('favoriteStore');
        alert("단골 매장이 해제되었습니다.");
    } else {
        localStorage.setItem('favoriteStore', placeName);
        alert(placeName + " 매장이 단골 매장으로 등록되었습니다!");
    }
    
    if (typeof updateProfileSummary === 'function') {
        updateProfileSummary();
    }
    
    if (window.lastSearchedPlaces) {
        const gs25List = document.getElementById('gs25-list');
        const cuList = document.getElementById('cu-list');
        if (gs25List) gs25List.innerHTML = '';
        if (cuList) cuList.innerHTML = '';
        window.lastSearchedPlaces.forEach(place => {
            const name = place.place_name.toUpperCase();
            if (name.includes('GS25') && gs25List) {
                displayPlace(place, gs25List, null);
            } else if (name.includes('CU') && cuList) {
                displayPlace(place, cuList, null);
            }
        });
    }
};

function displayPlace(place, listElement, map) {
    const distanceText = place.distance >= 1000 ? (place.distance / 1000).toFixed(1) + 'km' : place.distance + 'm';

    const listItem = document.createElement('li');
    listItem.style.cursor = 'pointer';
    listItem.style.position = 'relative';
    listItem.style.padding = '1.25rem';
    listItem.style.marginBottom = '1rem';
    listItem.style.borderRadius = '16px';
    listItem.style.background = '#f8fafc';
    listItem.style.border = '1px solid #e2e8f0';
    listItem.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    listItem.addEventListener('click', () => openMapModal(place.place_name, place.y, place.x));

    // Dynamic hover styles via listeners for high performance
    listItem.addEventListener('mouseenter', () => {
        listItem.style.transform = 'translateX(6px) scale(1.01)';
        listItem.style.borderColor = 'var(--primary-color)';
        listItem.style.boxShadow = '0 6px 20px rgba(67, 97, 238, 0.08)';
        listItem.style.background = '#ffffff';
        const chev = listItem.querySelector('.chev-btn');
        if (chev) {
            chev.style.transform = 'translateX(4px)';
            chev.style.color = 'var(--primary-color)';
        }
    });
    listItem.addEventListener('mouseleave', () => {
        listItem.style.transform = 'none';
        listItem.style.borderColor = '#e2e8f0';
        listItem.style.boxShadow = 'none';
        listItem.style.background = '#f8fafc';
        const chev = listItem.querySelector('.chev-btn');
        if (chev) {
            chev.style.transform = 'none';
            chev.style.color = '#cbd5e1';
        }
    });

    const pinSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    const homeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

    const isGS25 = place.place_name.toUpperCase().includes('GS25');
    const badgeColor = isGS25 ? '#0ea5e9' : '#8b5cf6';
    
    const favStore = localStorage.getItem('favoriteStore');
    const isFav = favStore === place.place_name;

    let titleBadgeHtml = '';
    let actionBtnHtml = '';
    
    if (isFav) {
        titleBadgeHtml = `<span style="background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; white-space: nowrap;">★ 내 단골 매장</span>`;
        actionBtnHtml = `<button onclick="window.toggleFavoriteStore('${place.place_name}', event)" style="background: #fff; border: 1px solid #ffe58f; color: #d48806; border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; z-index: 10; flex-shrink: 0;">★ 해제</button>`;
    } else {
        titleBadgeHtml = '';
        actionBtnHtml = `<button onclick="window.toggleFavoriteStore('${place.place_name}', event)" style="background: #fff; border: 1px solid #e2e8f0; color: #64748b; border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; z-index: 10; flex-shrink: 0;">☆ 단골등록</button>`;
    }

    listItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <h4 style="margin: 0; color: ${badgeColor}; font-size: 1.05rem; font-weight: 800;">${place.place_name}</h4>
                <div style="margin-bottom: 6px;">${titleBadgeHtml}</div>
            </div>
            ${actionBtnHtml}
        </div>
        <p style="margin: 6px 0; font-weight: bold; color: #EF4444; font-size: 0.88rem;">${pinSvg} 거리: ${distanceText}</p>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
            <p style="margin: 0; color: #64748b; font-size: 0.82rem; line-height: 1.4; flex: 1; padding-right: 8px; word-break: keep-all;">${homeSvg} ${place.road_address_name || place.address_name}</p>
            <div class="chev-btn" style="font-size: 0.9rem; color: #cbd5e1; transition: all 0.2s ease; white-space: nowrap; flex-shrink: 0;">더보기 ➔</div>
        </div>
    `;
    listElement.appendChild(listItem);
}

// 구글 지도 모달 열기
function openMapModal(placeName, lat, lng) {
    const modal = document.getElementById('mapModal');
    const title = document.getElementById('mapModalTitle');
    const mapContainer = document.getElementById('modal-map-view');
    const trendList = document.getElementById('modal-trend-list');
    
    if (!modal || !mapContainer) return;
    
    title.textContent = placeName;
    modal.style.display = 'block';

    const iframeHtml = `<iframe width="100%" height="100%" frameborder="0" style="border:0;" src="https://maps.google.com/maps?q=${lat},${lng}&hl=ko&z=17&output=embed" allowfullscreen></iframe>`;
    mapContainer.innerHTML = iframeHtml;
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    const mapContainer = document.getElementById('modal-map-view');
    if (modal) modal.style.display = 'none';
    if (mapContainer) mapContainer.innerHTML = '';
}

// 혜택 상세 탭 전환 함수
function switchBenefitTab(tabId) {
    document.querySelectorAll('.benefit-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.benefit-content-panel').forEach(panel => panel.classList.remove('active'));
    
    const selectedBtn = document.querySelector(`.benefit-tab-btn[data-tab="${tabId}"]`);
    const selectedPanel = document.getElementById(tabId);
    
    if (selectedBtn) selectedBtn.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');
}
window.switchBenefitTab = switchBenefitTab;

// 혜택 상세 모달 제어 함수
function openBenefitModal(type, shopName) {
    const modal = document.getElementById('benefitModal');
    const title = document.getElementById('benefitModalTitle');
    const body = document.getElementById('benefitModalBody');
    if (!modal || !title || !body) return;

    let contentHtml = '';
    let modalTitle = '';

    if (type === 'student') {
        modalTitle = '대학생 알짜 혜택 가이드';
        contentHtml = `
            <div class="benefit-tabs-container">
                <button class="benefit-tab-btn active" data-tab="telecom-panel" onclick="switchBenefitTab('telecom-panel')">통신사 혜택</button>
                <button class="benefit-tab-btn" data-tab="card-panel" onclick="switchBenefitTab('card-panel')">체크카드 혜택</button>
            </div>
            
            <!-- 통신사 탭 패널 -->
            <div id="telecom-panel" class="benefit-content-panel active">
                <div class="benefit-card-grid">
                    <div class="benefit-premium-card type-skt">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/skt_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="SKT"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">SKT 0청년 요금제</h4>
                            <p class="benefit-card-desc">매월 10일/20일/30일 '0 day' 행사로 편의점 <span class="benefit-card-highlight">최대 50% 할인 쿠폰</span> 제공 및 다양한 청년 문화 제휴 지원!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-kt">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/kt_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="KT"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">KT Y박스 / Y덤 멤버십</h4>
                            <p class="benefit-card-desc">29세 이하 전용 데이터 2배 제공 및 Y박스 앱 내 Y플레이존을 통한 <span class="benefit-card-highlight">20대 전용 편의점 할인 쿠폰 및 제휴 이벤트</span> 제공!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-lgu">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/lgu_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="LGU+"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">LG U+ 유쓰(Uth)</h4>
                            <p class="benefit-card-desc">매월 20일 해피 유쓰데이 편의점 무료 간식 교환권 및 <span class="benefit-card-highlight">GS25 현장 결제 10% 추가 상시 할인</span> 제공!</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 체크카드 탭 패널 -->
            <div id="card-panel" class="benefit-content-panel">
                <div class="benefit-card-grid">
                    <div class="benefit-premium-card type-shinhan">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/shinhan_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="신한"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">신한 S20 체크카드 (대학생 필수템)</h4>
                            <p class="benefit-card-desc">전월 실적 충족 시 <span class="benefit-card-highlight">GS25 이용 금액의 7% 캐시백</span>(환급)을 지원해 편의점 소비가 많다면 필수 카드!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-kb">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/kb_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="국민"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">KB국민 노리 체크카드</h4>
                            <p class="benefit-card-desc">CGV 35% 할인, 대중교통 10% 할인은 물론, <span class="benefit-card-highlight">주요 편의점 5% 환급 할인</span> 동시 지원!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-woori">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/woori_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="우리"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">우리카드 우리V체크카드</h4>
                            <p class="benefit-card-desc">주요 대학가 대학생들을 대상으로 편의점 추가 적립 포인트 및 학생 식당 할인 서비스 제공!</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'card') {
        const activeShop = shopName || '편의점';
        modalTitle = `${activeShop} 결제 카드 꿀팁`;
        
        let cardListHtml = '';
        if (activeShop.toUpperCase() === 'GS25') {
            cardListHtml = `
                <div class="benefit-card-grid">
                    <div class="benefit-premium-card type-shinhan">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/shinhan_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="신한"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">신한카드 Mr.Life (GS25 10% 할인)</h4>
                            <p class="benefit-card-desc">생활 편의 특화형 카드로 GS25 편의점 업종 이용 시 <span class="benefit-card-highlight">10% 청구 할인</span>이 기본 제공됩니다.</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-gs25">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/gs25_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="GS Pay"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">GS Pay (GS25 특화 간편결제)</h4>
                            <p class="benefit-card-desc">GS25 행사 상품(1+1, 2+1 등) 결제 시 <span class="benefit-card-highlight">현장에서 추가 10% 즉시 할인</span> 및 자동 적립 혜택!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-kb">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/samsung_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="삼성"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">삼성 iD ON 카드</h4>
                            <p class="benefit-card-desc">가장 많이 쓰는 선호 영역(편의점/배달/커피 등)을 스마트하게 감지해 자동으로 <span class="benefit-card-highlight">최대 30% 스페셜 할인</span> 선사!</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            cardListHtml = `
                <div class="benefit-card-grid">
                    <div class="benefit-premium-card type-woori">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/woori_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="우리"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">우리카드 D4 카드의정석 Ⅱ (CU 11% 할인)</h4>
                            <p class="benefit-card-desc">편의점에서 결제 시 <span class="benefit-card-highlight">11% 청구 할인</span>을 제공하여 최고의 체감 혜택을 주는 카드입니다.</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-cu">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/cu_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="CU Pay"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">CU 페이 (CU 특화 간편결제)</h4>
                            <p class="benefit-card-desc">CU 편의점에서 결제 시 결제 금액의 <span class="benefit-card-highlight">최대 5% CU 포인트 기본 적립</span> 및 멤버십 혜택 동시 적용!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-kb">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/kb_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="국민"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">KB국민 노리2 체크카드 (KB Pay)</h4>
                            <p class="benefit-card-desc">간편결제인 KB Pay 등록 후 편의점 현장 결제 시 최대 <span class="benefit-card-highlight">10% 환급 할인</span> 혜택 지원!</p>
                        </div>
                    </div>
                </div>
            `;
        }

        contentHtml = `
            <div style="text-align: left;">
                <p style="margin-bottom: 1.25rem; font-weight: bold; color: #1e293b; font-size: 1.05rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${activeShop} 맞춤 제휴 카드 목록</p>
                ${cardListHtml}
                <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 1.5rem; text-align: center;">*상세 한도 및 실적 조건은 카드사 안내 페이지를 참고해 주세요.</p>
            </div>
        `;
    } else if (type === 'payment') {
        modalTitle = '간편결제 현장 뽑기 혜택 상세';
        contentHtml = `
            <div style="text-align: left;">

                <div class="benefit-card-grid">
                    <div class="benefit-premium-card type-naver">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/naverpay_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="네이버페이"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">네이버페이 현장 포인트 뽑기</h4>
                            <p class="benefit-card-desc">QR 현장 결제 완료 즉시 무작위 네이버포인트가 100% 당첨되는 상자가 팝업됩니다. <span class="benefit-card-highlight">네이버플러스 멤버십 회원은 2배 적립</span> 혜택 적용!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-kakao">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/kakaopay_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="카카오페이"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">카카오페이 알 모으기 리워드</h4>
                            <p class="benefit-card-desc">바코드로 결제할 때마다 카카오 알 리워드가 전송됩니다. 알을 터치해 깨뜨리면 무작위 카카오페이 포인트가 <span class="benefit-card-highlight">꽝 없이 100% 지급</span>됩니다!</p>
                        </div>
                    </div>
                    <div class="benefit-premium-card type-toss">
                        <div class="benefit-card-icon-box" style="background: transparent;"><img src="img/tosspay_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="토스페이"></div>
                        <div class="benefit-card-info">
                            <h4 class="benefit-card-title">토스페이 행운복권 & 즉석 캐시백</h4>
                            <p class="benefit-card-desc">토스페이 현장결제 시 럭키 드로우 기회가 주어져 무작위 캐시백이 환급되며, 토스 앱 행운복권을 <span class="benefit-card-highlight">즉석에서 긁어 추가 적립</span>이 가능합니다!</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    title.textContent = modalTitle;
    body.innerHTML = contentHtml;
    modal.style.display = 'block';
}

function closeBenefitModal() {
    const modal = document.getElementById('benefitModal');
    if (modal) modal.style.display = 'none';
}

// 채팅 관련 로직
function addMessageToChat(sender, text) {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    
    // --- 수정된 부분 ---
    // 1. 받은 텍스트의 줄바꿈 문자(\n)를 HTML 줄바꿈 태그(<br>)로 변경합니다.
    const formattedText = text.replace(/\n/g, '<br>');
    // 2. textContent 대신 innerHTML을 사용하여 <br> 태그가 적용되도록 합니다.
    messageElement.innerHTML = formattedText;
    // --------------------
    
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; // 항상 최신 메시지가 보이도록 스크롤
}

// 비주얼 영수증 카드를 챗봇 창에 추가하는 함수
function addReceiptToChat(data) {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', 'bot-message');
    messageElement.style.padding = '0'; // 영수증 카드 내부 패딩 사용
    messageElement.style.background = 'transparent';
    messageElement.style.border = 'none';
    messageElement.style.boxShadow = 'none';
    messageElement.style.maxWidth = '95%';
    
    const savingPercent = data.basePrice > 0 ? Math.round(((data.basePrice - data.finalPrice) / data.basePrice) * 100) : 0;
    
    let discountRowsHtml = '';
    if (data.discountDetails && data.discountDetails.length > 0) {
        data.discountDetails.forEach(detail => {
            let cleaned = detail.replace(/^•\s*/, '').trim();
            let title = cleaned;
            let amount = '';
            
            const amountMatch = cleaned.match(/\(([^)]+)\)$/);
            if (amountMatch) {
                amount = amountMatch[1];
                title = cleaned.replace(/\s*\([^)]+\)$/, '');
            }
            
            let amountHtml = '';
            if (title.includes('없음')) {
                amountHtml = `<span style="color: #94a3b8; font-size: 0.85rem;">-</span>`;
            } else {
                amountHtml = `<span class="receipt-discount-line">${amount ? amount : '적용 완료'}</span>`;
            }
            
            discountRowsHtml += `
                <div class="receipt-row">
                    <span style="color: ${title.includes('없음') ? '#94a3b8' : '#4a5568'};">${title}</span>
                    ${amountHtml}
                </div>
            `;
        });
    } else {
        discountRowsHtml = `
            <div class="receipt-row label-muted">
                <span>적용된 할인 혜택이 없습니다.</span>
            </div>
        `;
    }
    
    let tipsHtml = '';
    if (data.tips && data.tips.length > 0) {
        let tipsListHtml = '';
        data.tips.forEach(tip => {
            let icon = '';
            if (tip.type === 'student') {
                icon = `<img src="img/skt_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" alt="SKT">`;
            } else if (tip.type === 'card') {
                icon = `<img src="img/shinhan_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" alt="Card">`;
            } else if (tip.type === 'payment') {
                icon = `<img src="img/kakaopay_logo.svg" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" alt="Payment">`;
            } else {
                icon = `<img src="img/gs25_logo.png" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" alt="GS25">`;
            }
            
            tipsListHtml += `
                <div class="receipt-tip-item ${tip.type}" style="cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 8px; margin: 0 -8px;" onclick="openBenefitModal('${tip.type}', '${data.shop}')" onmouseover="this.style.background='rgba(67, 97, 238, 0.05)'" onmouseout="this.style.background='transparent'">
                    <div class="receipt-tip-icon-wrapper">
                        ${icon}
                    </div>
                    <div class="receipt-tip-content">
                        <span class="receipt-tip-badge">${tip.badge}</span>
                        <p class="receipt-tip-text">${tip.text} <span style="font-size: 0.75rem; color: var(--primary-color); font-weight: bold; margin-left: 4px; white-space: nowrap;">더보기 ➔</span></p>
                    </div>
                </div>
            `;
        });
        
        tipsHtml = `
            <div class="receipt-tips-box">
                ${tipsListHtml}
            </div>
        `;
    } else if (data.cardRecommendation) {
        tipsHtml = `
            <div class="receipt-tips-box" style="font-size: 0.8rem; line-height: 1.5; color: #4a5568; padding: 0.85rem;">
                ${data.cardRecommendation.replace(/\n/g, '<br>')}
            </div>
        `;
    }
    let shopColor = data.shop === 'CU' ? '#652b8e' : '#007cff';
    let productImg = data.imgUrl ? 
        `<img src="${data.imgUrl}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 8px; border: 1px solid #f1f5f9; padding: 2px; background: white;" alt="Product">` : 
        `<div style="width: 48px; height: 48px; background: #f8f9fa; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:0.7rem;">이미지</div>`;

    messageElement.innerHTML = `
        <div class="receipt-card" style="border-top-color: ${shopColor}; border-top-width: 6px;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
                <div style="flex: 1; padding-right: 12px;">
                    <span style="background: ${shopColor}; color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; display: inline-block; margin-bottom: 6px;">${data.shop}</span>
                    <h3 class="receipt-title" style="margin: 0; line-height: 1.4; word-break: keep-all;">${data.itemName}</h3>
                </div>
                <div style="flex-shrink: 0;">
                    ${productImg}
                </div>
            </div>
            
            <div class="receipt-row label-muted">
                <span>기본 정가</span>
                <span style="text-decoration: line-through;">${data.basePrice.toLocaleString()}원</span>
            </div>
            
            <div class="receipt-divider"></div>
            
            ${discountRowsHtml}
            
            <div class="receipt-row total-row">
                <span style="font-weight: 700; color: #1a202c; font-size: 0.95rem;">최종 혜택가</span>
                <div class="receipt-total-price-box">
                    <span class="receipt-total-price">${data.finalPrice.toLocaleString()}원</span>
                    ${savingPercent > 0 ? `<span class="receipt-saving-badge">-${savingPercent}% 절약</span>` : ''}
                </div>
            </div>
            
            ${tipsHtml}
            
            <!-- AI Studio 연동 CTA 버튼 -->
            <button onclick="goToAIStudio('${data.shop}')" style="width: 100%; margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(66, 133, 244, 0.3); transition: transform 0.2s;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                나만의 소비 계획 Google AI Studio에서 만들기
            </button>
        </div>
    `;
    
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 구글 AI Studio 연동을 위한 함수
window.goToAIStudio = function(shop) {
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    let userInfo = '';
    if (loggedInUserStr) {
        const user = JSON.parse(loggedInUserStr);
        // 소비 스타일 매핑
        const styleMap = {
            'health': '헬시 플레저(건강 중시)',
            'dessert': '디저트 매니아',
            'brand': '브랜드 충성(신뢰 중시)',
            'trend': '신상/트렌드 추구'
        };
        const styleText = styleMap[user.style] || '가성비 중심';
        userInfo = `나는 평소에 '${styleText}' 소비 스타일을 가지고 있어. `;
    }
    
    const promptText = `${userInfo}지금 ${shop} 편의점에서 쇼핑을 하려고 하는데, 
내 스타일에 맞는 상품 꿀조합을 추천해주고, 예산 만원 안에서 어떻게 구매하면 가장 만족도가 높을지 제안해줘.`;

    // 클립보드 복사 후 새 창 열기
    navigator.clipboard.writeText(promptText).then(() => {
        alert("✨ 나만의 맞춤형 AI 프롬프트가 복사되었습니다!\n\n새로 열린 구글 AI Studio 창에서 아래쪽 채팅 입력칸에 붙여넣기(Ctrl+V / Cmd+V) 해보세요.\n내 예산과 취향에 꼭 맞는 완벽한 소비 계획을 제안받을 수 있습니다! 🚀");
        window.open('https://aistudio.google.com/app/prompts/new_chat', '_blank');
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        window.open('https://aistudio.google.com/app/prompts/new_chat', '_blank');
    });
};

// 메시지 전송 기능
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();
    if (messageText === '') return;

    addMessageToChat('user', messageText);
    chatInput.value = '';

    // 잡담 및 일상 대화 예외 처리 (Fallback)
    const smallTalkKeywords = ['안녕', '고마워', '누구야', '반가워', '안뇽', '감사', '누구니', 'ㅎㅇ'];
    const isSmallTalk = smallTalkKeywords.some(keyword => messageText.includes(keyword));

    if (isSmallTalk && messageText.length < 15) {
        addMessageToChat('bot', '저는 편의점 할인 정보를 찾아주는 Young-AI 파트너입니다! 잡담보다는 편의점 할인을 기가 막히게 잘 찾으니, 언제든 찾고 싶은 상품이 있다면 편하게 말씀해 주세요!');
        return;
    }

    addMessageToChat('bot', '최적의 할인 정보를 찾고 있습니다...');

    const loggedInUserStr = localStorage.getItem('loggedInUser');
    if (!loggedInUserStr) return;
    const loggedInUser = JSON.parse(loggedInUserStr);

    const serverUrl = 'https://young-ai-budget-mate-api.cana1222.workers.dev/search'; 
    
    fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            item_name: messageText,
            user_style: loggedInUser.style || 'health',
            user_store: loggedInUser.store || 'GS25',
            user_telecom: loggedInUser.carrier || 'none',
            user_telecom_tier: loggedInUser.carrier_tier || 'none',
            user_is_student_telecom: loggedInUser.is_student_telecom || false,
            user_card: loggedInUser.card || 'none',
            user_payment: loggedInUser.payment || 'none',
            favorite_store: localStorage.getItem('favoriteStore') || null
        }),
    })
    .then(response => {
        if (!response.ok) throw new Error('서버 응답 오류: ' + response.status);
        return response.json();
    })
    .then(data => {
        const chatWindow = document.getElementById('chatWindow');
        const loadingMessage = Array.from(chatWindow.querySelectorAll('.bot-message')).pop();
        if (loadingMessage && loadingMessage.textContent.includes('찾고 있습니다')) {
            loadingMessage.remove();
        }

        if (data.type === 'list') {
            addMessageToChat('bot', data.message);
            const optionsContainer = document.createElement('div');
            optionsContainer.style.display = 'flex';
            optionsContainer.style.flexWrap = 'wrap';
            optionsContainer.style.gap = '8px';
            optionsContainer.style.marginTop = '10px';
            
            data.options.forEach(option => {
                const btn = document.createElement('button');
                btn.textContent = option;
                btn.className = 'option-btn';
                btn.style.padding = '8px 14px';
                btn.style.border = '1px solid var(--primary-color)';
                btn.style.borderRadius = '20px';
                btn.style.backgroundColor = 'white';
                btn.style.color = 'var(--primary-color)';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '0.85em';

                btn.onclick = () => {
                    document.getElementById('chatInput').value = option;
                    sendMessage();
                };
                optionsContainer.appendChild(btn);
            });
            chatWindow.appendChild(optionsContainer);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else if (data.type === 'result') {
            if (data.itemName) {
                addReceiptToChat(data);
            } else {
                addMessageToChat('bot', data.message);
            }
            
            let savedAmount = data.saved_amount || Math.floor(Math.random() * 1500) + 500;
            if (savedAmount > 0) {
                const confirmContainer = document.createElement('div');
                confirmContainer.style.marginTop = '8px';
                confirmContainer.style.marginBottom = '12px';
                confirmContainer.style.textAlign = 'right';
                
                const confirmBtn = document.createElement('button');
                confirmBtn.innerHTML = `🛒 결제 확정 및 절약 반영 (+${savedAmount.toLocaleString()}원)`;
                confirmBtn.style.padding = '10px 16px';
                confirmBtn.style.backgroundColor = 'var(--primary-color)';
                confirmBtn.style.color = 'white';
                confirmBtn.style.border = 'none';
                confirmBtn.style.borderRadius = '12px';
                confirmBtn.style.fontWeight = 'bold';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.style.boxShadow = '0 4px 10px rgba(67, 97, 238, 0.2)';
                confirmBtn.style.transition = 'all 0.2s';
                
                confirmBtn.onclick = () => {
                    if (confirmBtn.disabled) return;
                    let saved = parseInt(localStorage.getItem('totalSavedAmount')) || 0;
                    saved += savedAmount;
                    localStorage.setItem('totalSavedAmount', saved);
                    
                    // 구글 스프레드시트 연동 대비: 상세 내역 저장 (JSON)
                    let history = JSON.parse(localStorage.getItem('savingHistory')) || [];
                    history.push({
                        date: new Date().toISOString(),
                        shop: data.shop || '편의점',
                        itemName: data.itemName || '상품',
                        basePrice: data.basePrice || 0,
                        finalPrice: data.finalPrice || 0,
                        savedAmount: savedAmount
                    });
                    localStorage.setItem('savingHistory', JSON.stringify(history));
                    
                    updateDashboard(saved);
                    
                    confirmBtn.innerHTML = `✅ 내 소비 리포트에 반영 완료!`;
                    confirmBtn.style.backgroundColor = '#10b981';
                    confirmBtn.style.boxShadow = 'none';
                    confirmBtn.style.cursor = 'default';
                    confirmBtn.disabled = true;
                };
                
                confirmContainer.appendChild(confirmBtn);
                const chatWindow = document.getElementById('chatWindow');
                chatWindow.appendChild(confirmContainer);
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
            
            // 근처 편의점 찾기 버튼 (스크롤 이동으로 변경)
            const mapLinkBtn = document.createElement('button');
            mapLinkBtn.textContent = `📍 근처 ${data.shop} 지도로 보기`;
            mapLinkBtn.style.margin = '5px 0 15px 0';
            mapLinkBtn.style.padding = '8px 16px';
            mapLinkBtn.style.backgroundColor = '#28a745';
            mapLinkBtn.style.color = 'white';
            mapLinkBtn.style.border = 'none';
            mapLinkBtn.style.borderRadius = '20px';
            mapLinkBtn.style.cursor = 'pointer';
            mapLinkBtn.style.fontWeight = '600';
            
            mapLinkBtn.onclick = () => {
                document.getElementById('storeListContainer').scrollIntoView({ behavior: 'smooth' });
                
                // 필터링 적용 및 슬라이딩 UI 동기화
                const filterContainer = document.querySelector('.store-filter-buttons');
                const fGS25 = document.getElementById('filterGS25');
                const fCU = document.getElementById('filterCU');
                const gs25Col = document.getElementById('gs25Column');
                const cuCol = document.getElementById('cuColumn');
                
                if (data.shop === 'GS25') {
                    if (fGS25) fGS25.classList.add('active');
                    if (fCU) fCU.classList.remove('active');
                    if (filterContainer) filterContainer.classList.remove('cu-active');
                    if (gs25Col) {
                        gs25Col.style.display = 'block';
                        gs25Col.style.animation = 'panelFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                    }
                    if (cuCol) cuCol.style.display = 'none';
                } else {
                    if (fCU) fCU.classList.add('active');
                    if (fGS25) fGS25.classList.remove('active');
                    if (filterContainer) filterContainer.classList.add('cu-active');
                    if (cuCol) {
                        cuCol.style.display = 'block';
                        cuCol.style.animation = 'panelFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                    }
                    if (gs25Col) gs25Col.style.display = 'none';
                }
                
                // 챗봇 창 내리기
                document.getElementById('floatingChatbot').classList.add('hidden');
            };
            
            chatWindow.appendChild(mapLinkBtn);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else if (data.message) {
            addMessageToChat('bot', data.message);
        } else {
            addMessageToChat('bot', '원하시는 정보를 찾지 못했습니다.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        addMessageToChat('bot', '앗, 잠시 정보를 불러오는 데 문제가 생겼어요. 네트워크 상태를 확인해 주세요!');
    });
}

// 맞춤형 큐레이션 카드 렌더링
function renderCurationCards(userStyle) {
    const list = document.getElementById('curationList');
    if (!list) return;
    
    // 로딩 UI (스켈레톤) 표시 (6개)
    list.innerHTML = `
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
        <div class="curation-item skeleton" style="min-height: 120px;"></div>
    `;

    const loggedInUserStr = localStorage.getItem('loggedInUser');
    let userStore = 'none';
    if (loggedInUserStr) {
        try {
            const user = JSON.parse(loggedInUserStr);
            userStore = user.store || 'none';
        } catch (e) {}
    }

    fetch('https://young-ai-budget-mate-api.cana1222.workers.dev/api/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userStyle, userStore })
    })
    .then(res => res.json())
    .then(data => {
        const items = data.items || [];
        if (items.length === 0) {
            fallbackCurationCards(userStyle, list, userStore);
            return;
        }
        
        list.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'curation-item type-' + (userStyle || 'trend');
            let priceText = item.price ? (typeof item.price === 'number' ? item.price.toLocaleString() + '원' : item.price) : '가격 변동';
            let imageHtml = item.img;
            if (typeof imageHtml === 'string' && imageHtml.includes('<svg')) {
                imageHtml = `<div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; background-color: #f8f9fa; border-radius: 12px; color: #adb5bd; font-size: 0.8rem; font-weight: bold; border: 1px dashed #dee2e6; margin: 0 auto;">NO IMAGE</div>`;
            }

            div.innerHTML = `
                <div style="margin-bottom: 10px; display: flex; justify-content: center;">${imageHtml}</div>
                <span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold;">${item.badge}</span>
                <h4 style="margin: 10px 0 5px 0; word-break: keep-all; font-size: 1.05rem;">${item.name}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                    <p style="margin: 0; font-size: 0.85rem; color: #666; font-weight: bold;">${item.desc}</p>
                    <p style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">${priceText}</p>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: #4F46E5; font-weight: bold;">${item.comment || "요즘 제일 잘나가는 픽!"}</p>
            `;
            div.onclick = () => {
                const chatBtn = document.getElementById('chatbotFab');
                if(chatBtn) chatBtn.click();
                document.getElementById('chatInput').value = item.name;
                sendMessage();
            };
            list.appendChild(div);
        });
    })
    .catch(error => {
        console.error("Curation Error:", error);
        fallbackCurationCards(userStyle, list, userStore);
    });
}

function fallbackCurationCards(userStyle, list, userStore = 'none') {
    let items = [];
    if (userStyle === 'health') {
        items = [
            { name: "닭가슴살 소시지", badge: "1+1", desc: "GS25", price: 2000, comment: "단백질 든든하게 채우세요", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 22l10-10"/></svg>' },
            { name: "더건강식단 샐러드", badge: "할인", desc: "GS25", price: 4500, comment: "가벼운 한 끼 식사", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 22l10-10"/></svg>' },
            { name: "반숙란 2입", badge: "할인", desc: "GS25", price: 2200, comment: "부담 없이 가볍게 즐겨요", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
            { name: "제로 펩시 500ml", badge: "2+1", desc: "CU", price: 2000, comment: "부담 없이 가볍게 즐겨요", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>' },
            { name: "헤이루 닭가슴살바", badge: "HOT", desc: "CU", price: 1800, comment: "가성비 단백질 픽!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 22l10-10"/></svg>' },
            { name: "단백질 음료 프로틴", badge: "1+1", desc: "CU", price: 2900, comment: "운동 후 필수템", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>' }
        ];
    } else if (userStyle === 'dessert') {
        items = [
            { name: "두바이 초콜릿", badge: "HOT", desc: "CU", price: 4000, comment: "요즘 제일 잘나가는 픽!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
            { name: "연세우유 크림빵", badge: "신상", desc: "CU", price: 2900, comment: "당 충전이 필요할 때 딱!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
            { name: "초코 퐁당 케이크", badge: "할인", desc: "CU", price: 3500, comment: "달달한 오후를 위한", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>' },
            { name: "하겐다즈 파인트", badge: "할인", desc: "GS25", price: 11000, comment: "요즘 제일 잘나가는 픽!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>' },
            { name: "브레디크 생크림빵", badge: "HOT", desc: "GS25", price: 2800, comment: "부드러운 크림 한가득", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
            { name: "티라미수 컵케익", badge: "2+1", desc: "GS25", price: 3200, comment: "고급스러운 달콤함", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' }
        ];
    } else {
        items = [
            { name: "유어스 오모리김치", badge: "1+1", desc: "GS25", price: 1800, comment: "1+1 행사로 쟁여두기 필수!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>' },
            { name: "삼각김밥 참치마요", badge: "할인", desc: "GS25", price: 1200, comment: "요즘 제일 잘나가는 픽!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' },
            { name: "소시지야채볶음", badge: "2+1", desc: "GS25", price: 3500, comment: "밥도둑 반찬", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>' },
            { name: "백종원 도시락", badge: "HOT", desc: "CU", price: 4500, comment: "요즘 제일 잘나가는 픽!", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
            { name: "자이언트 떡볶이", badge: "HOT", desc: "CU", price: 3200, comment: "매콤달콤 베스트셀러", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>' },
            { name: "HEYROO 라면", badge: "할인", desc: "CU", price: 1500, comment: "가성비 끝판왕", img: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' }
        ];
    }
    
    // Filter items based on userStore if it's set
    if (userStore && userStore !== 'none') {
        const filteredItems = items.filter(item => item.desc.toUpperCase().includes(userStore.toUpperCase()));
        if (filteredItems.length > 0) {
            items = filteredItems;
        }
    }

    
    list.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'curation-item type-' + (userStyle || 'trend');
        
        // 카드 상단 영역 (아이콘 + 브랜드)
        const brandBadge = document.createElement('div');
        brandBadge.className = 'item-brand-badge';
        
        let logoSrc = '';
        let logoHeight = '18px';
        const brand = item.desc.split(' ')[0]; // GS25 또는 CU 추출
        if (brand === 'CU') {
            logoSrc = 'img/cu_logo.png';
            logoHeight = '24px'; // CU 로고는 약간 둥글/정사각형 비율이라 더 크게
        } else if (brand === 'GS25') {
            logoSrc = 'img/gs25_logo.png';
            logoHeight = '14px'; // GS25 로고는 가로로 길어서 높이가 낮아야 비율이 맞음
        }
        
        if (logoSrc) {
            brandBadge.innerHTML = `<img src="${logoSrc}" alt="${brand}" style="height: ${logoHeight}; object-fit: contain;">`;
        } else {
            brandBadge.textContent = brand;
        }

        let imageHtml = item.img;
        if (typeof imageHtml === 'string' && imageHtml.includes('<svg')) {
            imageHtml = `<div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; background-color: #f8f9fa; border-radius: 12px; color: #adb5bd; font-size: 0.8rem; font-weight: bold; border: 1px dashed #dee2e6; margin: 0 auto;">NO IMAGE</div>`;
        }

        div.innerHTML = `
            <div style="margin-bottom: 10px; display: flex; justify-content: center;">${imageHtml}</div>
            <span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold;">${item.badge}</span>
            <h4 style="margin: 10px 0 5px 0;">${item.name}</h4>
            <p style="margin: 0; font-size: 0.85rem; color: #666;">${item.desc}</p>
            <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: #4F46E5; font-weight: bold;">${item.comment}</p>
        `;
        div.prepend(brandBadge);
        div.onclick = () => {
            const chatBtn = document.getElementById('chatbotFab');
            if(chatBtn) chatBtn.click();
            document.getElementById('chatInput').value = item.name;
            sendMessage();
        };
        list.appendChild(div);
    });
}

window.updateProfileSummary = function() {
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    if (!loggedInUserStr) return;
    const loggedInUser = JSON.parse(loggedInUserStr);
    const summaryTagsEl = document.getElementById('profileSummaryTags');
    if (summaryTagsEl) {
        const styleMap = { 'health': '🥗 헬시 플레저', 'dessert': '🍰 디저트 러버', 'brand': '🏪 브랜드 선호', 'trend': '🔥 신상/트렌드' };
        const userStyleText = styleMap[loggedInUser.style] || '선택 안함';
        const userStoreText = (loggedInUser.store && loggedInUser.store !== 'none') ? loggedInUser.store : '선택 안함';
        const userCardText = (loggedInUser.card && loggedInUser.card !== 'none') ? loggedInUser.card : '선택 안함';
        const userTelecomText = (loggedInUser.telecom && loggedInUser.telecom !== 'none') ? loggedInUser.telecom : '선택 안함';
        
        let tagsHTML = '';
        tagsHTML += `<span style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; color: #475569;">편의점: <strong>${userStoreText}</strong></span>`;
        tagsHTML += `<span style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; color: #475569;">스타일: <strong>${userStyleText}</strong></span>`;
        tagsHTML += `<span style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; color: #475569;">통신사: <strong>${userTelecomText}</strong></span>`;
        tagsHTML += `<span style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; color: #475569;">결제카드: <strong>${userCardText}</strong></span>`;
        
        if(loggedInUser.payment && loggedInUser.payment !== 'none') {
            const payMap = { 'naver': '네이버페이', 'kakao': '카카오페이', 'toss': '토스페이' };
            const paymentStr = loggedInUser.payment.split(',').map(p => payMap[p.trim()] || p.trim()).join(', ');
            tagsHTML += `<span style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; color: #475569;">간편결제: <strong>${paymentStr}</strong></span>`;
        }
        if(loggedInUser.student_telecom === 'yes') {
            tagsHTML += `<span style="background: #eef2ff; border: 1px solid #818cf8; padding: 4px 10px; border-radius: 8px; color: #4338ca;">🎓 대학생 전용 요금제</span>`;
        }
        
        const favStore = localStorage.getItem('favoriteStore');
        if (favStore) {
            tagsHTML += `<span style="background: #fffbe6; border: 1px solid #ffe58f; padding: 4px 10px; border-radius: 8px; color: #d48806;">단골: <strong>${favStore}</strong></span>`;
        }
        
        summaryTagsEl.innerHTML = tagsHTML;
    }
};

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    if (!loggedInUserStr) {
        window.location.href = 'index.html';
        return;
    }
    const loggedInUser = JSON.parse(loggedInUserStr);
    
    // 헤더 업데이트
    const userNameEl = document.getElementById('homeUserName');
    if (userNameEl) userNameEl.textContent = loggedInUser.name;

    // 프로필 요약 태그 채우기
    window.updateProfileSummary();

    // 대시보드 초기화
    let saved = parseInt(localStorage.getItem('totalSavedAmount')) || 0;
    updateDashboard(saved);
    
    // 위치 및 큐레이션 초기화
    getUserLocation();
    renderCurationCards(loggedInUser.style);
    
    // 큐레이션 타이틀 설정
    const curTitle = document.getElementById('curationTitle');
    if (curTitle) {
        const fireSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>';
        
        let storePrefix = '';
        if (loggedInUser.store && loggedInUser.store !== 'none') {
            const isCU = loggedInUser.store.toUpperCase() === 'CU';
            const logoFile = isCU ? 'cu_logo.png' : 'gs25_logo.png';
            const logoHeight = isCU ? '32px' : '20px'; // CU 로고는 거의 정사각형이므로 높이를 확 키워줌
            const marginBottom = isCU ? '-4px' : '0'; // 큰 이미지 정렬 맞춤
            
            storePrefix = `<img src="img/${logoFile}" style="height: ${logoHeight}; vertical-align: middle; margin-bottom: ${marginBottom}; margin-right: 4px;" alt="${loggedInUser.store}"> `;
        }
        
        if(loggedInUser.style === 'health') curTitle.innerHTML = fireSvg + storePrefix + "건강한 하루를 위한 픽";
        else if(loggedInUser.style === 'dessert') curTitle.innerHTML = fireSvg + storePrefix + "달콤한 휴식, 디저트 픽";
        else if(loggedInUser.style === 'trend') curTitle.innerHTML = fireSvg + storePrefix + "요즘 뜨는 핫 트렌드 픽";
        else curTitle.innerHTML = fireSvg + storePrefix + "가성비 갑! 오늘의 혜택 픽";
    }

    const initialBotMessage = document.querySelector('.chat-window .bot-message');
    if (initialBotMessage) {
        let greetingMsg = `<strong>${loggedInUser.name}</strong>님, 환영합니다! 🎉<br><br>`;
        greetingMsg += `<strong style="color:#007bff; font-size:1em;">[핵심 사용 가이드]</strong><br>`;
        greetingMsg += `<strong style="color: #e67e22;">최저가 검색:</strong> '오레오' 등 상품명을 치면 최적할인을 찾아드려요!<br>`;
        greetingMsg += `<strong style="color: #4F46E5;">맞춤 추천:</strong> '달달한 거' 등을 치면 취향에 맞게 추천해 드려요!`;
        initialBotMessage.innerHTML = greetingMsg;
    }

    // 플로팅 챗봇 토글 로직
    const fab = document.getElementById('chatbotFab');
    const chatbotWindow = document.getElementById('floatingChatbot');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const expandChatBtn = document.getElementById('expandChatBtn');
    
    if (fab && chatbotWindow) {
        fab.addEventListener('click', () => {
            chatbotWindow.classList.toggle('hidden');
        });
    }
    
    if (closeChatBtn && chatbotWindow) {
        closeChatBtn.addEventListener('click', () => {
            chatbotWindow.classList.add('hidden');
            chatbotWindow.classList.remove('fullscreen');
        });
    }
    
    if (expandChatBtn && chatbotWindow) {
        expandChatBtn.addEventListener('click', () => {
            chatbotWindow.classList.toggle('fullscreen');
            if (chatbotWindow.classList.contains('fullscreen')) {
                expandChatBtn.textContent = '🗗'; // 축소 아이콘
            } else {
                expandChatBtn.textContent = '⛶'; // 확대 아이콘
            }
        });
    }

    // 편의점 지도 탭 필터링 로직
    const filterGS25 = document.getElementById('filterGS25');
    const filterCU = document.getElementById('filterCU');
    const gs25Column = document.getElementById('gs25Column');
    const cuColumn = document.getElementById('cuColumn');

    if (filterGS25 && filterCU) {
        const filterContainer = document.querySelector('.store-filter-buttons');
        
        filterGS25.addEventListener('click', () => {
            filterGS25.classList.add('active');
            filterCU.classList.remove('active');
            if (filterContainer) filterContainer.classList.remove('cu-active');
            if (gs25Column) {
                gs25Column.style.display = 'block';
                gs25Column.style.animation = 'panelFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            }
            if (cuColumn) cuColumn.style.display = 'none';
        });

        filterCU.addEventListener('click', () => {
            filterCU.classList.add('active');
            filterGS25.classList.remove('active');
            if (filterContainer) filterContainer.classList.add('cu-active');
            if (cuColumn) {
                cuColumn.style.display = 'block';
                cuColumn.style.animation = 'panelFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            }
            if (gs25Column) gs25Column.style.display = 'none';
        });
    }

    // 로그아웃 버튼
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        });
    }

    // 챗봇 전송 이벤트
    const chatInput = document.getElementById('chatInput');
    const chatSendButton = document.getElementById('chatSendButton');

    if (chatSendButton) chatSendButton.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // 이미지 스캔
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                addMessageToChat('user', `[이미지 스캔 요청: ${file.name}]`);
                addMessageToChat('bot', 'AI가 분석하고 있습니다...');
                
                setTimeout(() => {
                    fetch('https://young-ai-budget-mate-api.cana1222.workers.dev/api/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: file.name })
                    })
                    .then(res => res.json())
                    .then(data => {
                        const chatWindow = document.getElementById('chatWindow');
                        const loadingMessage = Array.from(chatWindow.querySelectorAll('.bot-message')).pop();
                        if (loadingMessage && loadingMessage.textContent.includes('분석하고 있습니다')) loadingMessage.remove();
                        addMessageToChat('bot', data.message);
                    })
                    .catch(err => {
                        console.error('Scan Error:', err);
                        const chatWindow = document.getElementById('chatWindow');
                        const loadingMessage = Array.from(chatWindow.querySelectorAll('.bot-message')).pop();
                        if (loadingMessage && loadingMessage.textContent.includes('분석하고 있습니다')) loadingMessage.remove();
                        
                        const mockMessage = "[Vision AI 스캔 완료!]\n\n• 품목: 오레오씬즈화이트 (2,000원)\n\n알림: 등록하신 통신사 바코드를 제시하셨다면 200원을 아낄 수 있었어요. 현재 1+1 행사 중이니 다음에 꼭 챙기세요!";
                        addMessageToChat('bot', mockMessage);
                    });
                }, 2000);
            }
            e.target.value = '';
        });
    }

    // 실시간 브랜드 행사 알림 (Proactive AI) - 실제 데이터 연동
    setTimeout(() => {
        const storeName = (loggedInUser.store && loggedInUser.store !== 'none') ? loggedInUser.store : 'GS25';
        const userStyle = loggedInUser.style || 'trend';

        fetch('https://young-ai-budget-mate-api.cana1222.workers.dev/api/curation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userStyle, userStore: storeName })
        })
        .then(res => res.json())
        .then(data => {
            const items = data.items || [];
            if (items.length > 0) {
                // 첫 번째 상품을 알림으로 사용
                const realItem = items[Math.floor(Math.random() * items.length)];
                
                const safeName = realItem.name.replace(/'/g, "\\\\'");
                
                let displayStoreName = storeName;
                if (storeName === 'GS25' && window.nearestGS25) displayStoreName = window.nearestGS25;
                if (storeName === 'CU' && window.nearestCU) displayStoreName = window.nearestCU;
                
                const msg = `
                    <div style="margin-bottom: 12px; line-height: 1.5;">
                        <span style="font-weight: 800; color: #4F46E5;">[근처 ${storeName} 행사알림]</span><br>
                        근처에 있는 <strong>${displayStoreName}</strong>에서 현재 <strong>'${realItem.name}'</strong> 상품이 <strong style="color: #e74c3c;">${realItem.badge}</strong> 행사 중입니다!<br><br>
                        더 자세한 할인 조합이 궁금하신가요?
                    </div>
                    <div style="text-align: center; margin-top: 12px;">
                        <button onclick="document.getElementById('chatInput').value='${safeName}'; sendMessage();" style="display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 12px 0; background-color: #EEF2FF; color: #4F46E5; border: 1px solid #C7D2FE; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: background-color 0.2s; line-height: 1;" onmouseover="this.style.backgroundColor='#E0E7FF'" onmouseout="this.style.backgroundColor='#EEF2FF'">
                            <span>이 상품 혜택 알아보기 ➔</span>
                        </button>
                    </div>
                `;
                addMessageToChat('bot', msg);
        
                if (chatbotWindow.classList.contains('hidden')) {
                    fab.style.animation = 'skeletonLoading 0.5s 3';
                }
            }
        })
        .catch(err => console.error("Proactive AI fetch error:", err));
    }, 6000);
});
