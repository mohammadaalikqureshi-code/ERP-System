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

def get_json(url, token):
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

login_res = post_json('http://127.0.0.1:8001/api/v1/auth/login', {'email_or_phone': 'admin@medicare.com', 'password': 'Admin@123'})
token = login_res['access_token']

print("\n--- Testing Extended Endpoints ---")
endpoints = [
    '/users/staff',
    '/reports/revenue',
    '/reports/doctor-performance',
    '/reports/no-show-rates',
    '/billing/bills',
    '/clinics',
    '/branches'
]

for path in endpoints:
    try:
        data = get_json(f'http://127.0.0.1:8001/api/v1{path}', token)
        count = len(data) if isinstance(data, list) else data.get('total', 'Object')
        print(f"  [OK] {path} -> 200 OK (Items/Total: {count})")
    except Exception as e:
        print(f"  [FAIL] {path} -> {e}")
