import urllib.request
import urllib.error
import json
import time

url = 'http://127.0.0.1:8000/predict'
headers = {'Content-Type': 'application/json'}

def send_req(payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            status = response.status
    except urllib.error.HTTPError as e:
        data = json.loads(e.read().decode())
        status = e.code
    latency = (time.time() - t0) * 1000
    return status, latency, data

print('1. Normal Request (Latency Test)')
st, lat, data = send_req({'subcity': 'Bole', 'bedrooms': 2, 'bathrooms': 1, 'area_sqm': 100})
print(f'Status: {st}, Latency: {lat:.2f}ms, Data: {data}')

print('\n2. Unknown Subcity')
st, lat, data = send_req({'subcity': 'FakeCity', 'bedrooms': 2, 'bathrooms': 1, 'area_sqm': 100})
print(f'Status: {st}, Latency: {lat:.2f}ms, Data: {data}')

print('\n3. Massive Size (100,000 sqm)')
st, lat, data = send_req({'subcity': 'Bole', 'bedrooms': 2, 'bathrooms': 1, 'area_sqm': 100000})
print(f'Status: {st}, Latency: {lat:.2f}ms, Data: {data}')

print('\n4. Negative Size (-5 sqm)')
st, lat, data = send_req({'subcity': 'Bole', 'bedrooms': 2, 'bathrooms': 1, 'area_sqm': -5})
print(f'Status: {st}, Latency: {lat:.2f}ms, Data: {data}')

