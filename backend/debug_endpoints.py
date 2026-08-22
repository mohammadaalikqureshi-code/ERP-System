import json
import urllib.request

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

login_res = post_json('http://127.0.0.1:8001/api/v1/auth/login', {'email_or_phone': 'admin@medicare.com', 'password': 'Admin@123'})
token = login_res['access_token']

for path in ['/reports/doctor-performance', '/reports/no-show-rates', '/billing/bills']:
    req = urllib.request.Request(
        f'http://127.0.0.1:8001/api/v1{path}',
        headers={'Authorization': f'Bearer {token}'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"{path} OK: {resp.read().decode('utf-8')[:200]}")
    except urllib.error.HTTPError as e:
        print(f"{path} Error {e.code}: {e.read().decode('utf-8')}")
