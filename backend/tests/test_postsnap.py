"""PostSnap backend API tests"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

# Health checks
def test_api_root(client):
    r = client.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json()["status"] == "running"

def test_health(client):
    r = client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

# Generate caption
def test_generate_caption(client):
    r = client.post(f"{BASE_URL}/api/generate/caption", json={
        "description": "Chef's pasta carbonara special",
        "template": "today-special",
        "business_name": "The Tasty Fork",
        "business_type": "restaurant",
        "brand_style": "clean"
    })
    assert r.status_code == 200
    data = r.json()
    assert "caption" in data
    assert isinstance(data["caption"], str)
    assert len(data["caption"]) > 0

# Subscription/entitlement
def test_subscription_status(client):
    r = client.get(f"{BASE_URL}/api/subscription/status")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ["trial", "subscribed", "expired"]
    assert "days_left" in data

def test_entitlement_check(client):
    r = client.get(f"{BASE_URL}/api/entitlement/check")
    assert r.status_code == 200
    data = r.json()
    assert "eligible" in data

# Posts CRUD
def test_save_post(client):
    r = client.post(f"{BASE_URL}/api/posts", json={
        "template": "auto",
        "description": "TEST_ test post",
        "caption": "TEST_ test caption",
        "platforms": ["instagram"],
        "status": "draft"
    })
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    return data["id"]

def test_get_posts(client):
    r = client.get(f"{BASE_URL}/api/posts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_posts_filter_draft(client):
    r = client.get(f"{BASE_URL}/api/posts?status=draft")
    assert r.status_code == 200
    posts = r.json()
    for p in posts:
        assert p["status"] == "draft"

# Social accounts
def test_get_social_accounts(client):
    r = client.get(f"{BASE_URL}/api/social/accounts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

# Business profile
def test_save_business_profile(client):
    r = client.post(f"{BASE_URL}/api/business/profile", json={
        "name": "TEST_ Business",
        "type": "restaurant",
        "city": "Test City",
        "brand_style": "clean"
    })
    assert r.status_code == 200

def test_get_business_profile(client):
    r = client.get(f"{BASE_URL}/api/business/profile")
    assert r.status_code == 200
    data = r.json()
    assert "name" in data
