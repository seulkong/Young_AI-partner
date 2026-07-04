// Google Identity Services 연동 로직
function handleCredentialResponse(response) {
    // JWT 토큰 디코딩 (간단한 파싱)
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    
    // 유저 정보 추출
    const userName = payload.name;
    const userEmail = payload.email;
    const userPicture = payload.picture;

    // 프로필 정보 로컬 스토리지 임시 저장
    localStorage.setItem('googleUser', JSON.stringify({
        name: userName,
        email: userEmail,
        picture: userPicture
    }));

    // 이름 필드 자동 채우기 및 시각적 피드백
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.value = userName;
        nameInput.style.backgroundColor = '#f0fdf4';
        nameInput.style.borderColor = '#22c55e';
        nameInput.readOnly = true;
        
        // 로그인 성공 알림
        const container = document.getElementById('googleSignInContainer');
        if (container) {
            container.innerHTML = `<div style="background: #f0fdf4; color: #15803d; padding: 10px 15px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; border: 1px solid #bbf7d0; display: flex; align-items: center; gap: 8px;">
                <img src="${userPicture}" style="width: 24px; height: 24px; border-radius: 50%;" referrerpolicy="no-referrer">
                ${userName}님, 환영합니다! 아래에서 소비 스타일을 선택해주세요.
            </div>`;
        }
    }
}

window.onload = function () {
    // CLIENT_ID는 실제 발급받은 Google Client ID로 교체 필요 (MVP용 더미/임시 ID)
    const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; 

    if (window.google && window.google.accounts) {
        google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse
        });
        
        const container = document.getElementById("googleSignInContainer");
        if (container) {
            google.accounts.id.renderButton(
                container,
                { theme: "outline", size: "large", width: 280, text: "continue_with" }
            );
            // One Tap 자동 표시 (선택 사항)
            // google.accounts.id.prompt(); 
        }
    }
};
