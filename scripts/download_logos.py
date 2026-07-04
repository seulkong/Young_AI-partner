import urllib.request
import os

logos = {
    "gs25_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/7/78/GS25_bi_%282019%29.svg",
    "cu_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/1/1a/CU_BI_%282017%29.svg",
    "skt_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/f/f4/SK_telecom_logo.svg",
    "kt_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Kt-logo.svg",
    "lgu_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/b/bf/LG_Uplus_Logo.svg",
    "tosspay_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Toss_Logo_2022.svg",
    "kakaopay_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/f/f2/KakaoPay_logo.svg",
    "naverpay_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Naver_Pay_logo.svg",
    "shinhan_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/7/77/Shinhan_Bank_Logo.svg",
    "kb_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/e/e0/KB_Kookmin_Bank_logo.svg",
    "woori_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Woori_Bank_Logo.svg",
    "samsung_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Samsung_Logo.svg",
    "lotte_logo.svg": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Lotte_logo.svg"
}

output_dir = "/Users/seulbinlee/Antigravity/Vibe_hackathon/frontend/img"

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for name, url in logos.items():
    dest = os.path.join(output_dir, name)
    print(f"Downloading {url} to {dest}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            content = response.read()
            # If the content starts with <svg or contains svg tag
            if b"<svg" in content or b"<SVG" in content or b"svg" in content:
                with open(dest, "wb") as f:
                    f.write(content)
                print(f"Success: {name}")
            else:
                print(f"Failed (not an SVG): {name}, length: {len(content)}")
    except Exception as e:
        print(f"Error downloading {name}: {e}")
