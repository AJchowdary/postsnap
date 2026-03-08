"""
PostSnap backend API tests - v2
Covers: auth, account, posts, generate, social, subscription
Uses JWT auth for protected routes.

Auth: POST /api/auth/register (201) and POST /api/auth/login (200) return
{ "user": { "id", "email" }, "token" }. GET /api/auth/me returns { "userId" }.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials (unique per run)
TS = str(int(time.time()))
TEST_EMAIL = f"TEST_{TS}@testpostsnap.com"
TEST_PASSWORD = "testpass123!"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(client):
    """Register (or login if already registered) and return auth token"""
    r = client.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if r.status_code == 201:
        return r.json()["token"]
    # Email already exists - login instead
    r2 = client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert r2.status_code == 200, f"Login failed: {r2.status_code} - {r2.text}"
    return r2.json()["token"]


@pytest.fixture(scope="module")
def auth_client(client, auth_token):
    """Authenticated client session"""
    client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return client


# ============================
# Health & Root
# ============================
class TestHealth:
    """Health and root endpoint tests"""

    def test_api_root(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "running"
        print("✓ API root OK")

    def test_health(self, client):
        r = client.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        print("✓ Health OK")


# ============================
# Auth
# ============================
class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self, client):
        ts = str(int(time.time() * 1000))
        r = client.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_reg_{ts}@testpostsnap.com",
            "password": "password123!"
        })
        assert r.status_code == 201, f"Register failed: {r.text}"
        data = r.json()
        assert "token" in data
        assert "user" in data
        assert "id" in data["user"]
        assert "email" in data["user"]
        print("✓ Register new user OK")

    def test_register_duplicate_email(self, client):
        """Second registration with same email should fail"""
        # First register
        ts = str(int(time.time() * 1000))
        email = f"TEST_dup_{ts}@testpostsnap.com"
        client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password123!"
        })
        # Second attempt
        r = client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password123!"
        })
        assert r.status_code in [400, 409, 422], f"Expected error, got {r.status_code}: {r.text}"
        print("✓ Duplicate email rejected OK")

    def test_login_valid_credentials(self, client):
        # Register the user first (may already exist from auth_token fixture or prior run)
        client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        assert "token" in data
        assert "user" in data
        print("✓ Login with valid credentials OK")

    def test_login_invalid_credentials(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert r.status_code in [400, 401, 422], f"Expected auth error, got {r.status_code}: {r.text}"
        print("✓ Login with invalid credentials rejected OK")

    def test_login_nonexistent_user(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nobody_exists_999@testpostsnap.com",
            "password": "password123!"
        })
        assert r.status_code in [400, 401, 404, 422], f"Expected error, got {r.status_code}: {r.text}"
        print("✓ Login with nonexistent user rejected OK")

    def test_auth_me_with_token(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, f"Auth/me failed: {r.text}"
        data = r.json()
        assert "userId" in data
        print(f"✓ Auth/me OK - userId: {data['userId']}")

    def test_auth_me_without_token(self, client):
        """No auth token should return 401"""
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("✓ Unauthorized access rejected OK")


# ============================
# Account / Bootstrap
# ============================
class TestAccount:
    """Account and business profile tests"""

    def test_bootstrap_account(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/account/bootstrap")
        assert r.status_code == 200, f"Bootstrap failed: {r.text}"
        # Bootstrap returns account object (may be empty on first call)
        data = r.json()
        assert isinstance(data, dict)
        print(f"✓ Account bootstrap OK: {data}")

    def test_get_account_me(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/account/me")
        assert r.status_code == 200, f"Account/me failed: {r.text}"
        data = r.json()
        assert isinstance(data, dict)
        print(f"✓ Account/me OK")

    def test_update_business_profile(self, auth_client):
        r = auth_client.put(f"{BASE_URL}/api/account/profile", json={
            "name": "TEST_ Coffee Spot",
            "type": "cafe",
            "city": "San Francisco",
            "brandStyle": "clean",
            "useLogoOverlay": False
        })
        assert r.status_code == 200, f"Profile update failed: {r.text}"
        data = r.json()
        assert data.get("name") == "TEST_ Coffee Spot"
        print("✓ Business profile update OK")

    def test_get_profile_after_update(self, auth_client):
        """Verify profile persists after update"""
        r = auth_client.get(f"{BASE_URL}/api/account/me")
        assert r.status_code == 200
        data = r.json()
        assert data.get("name") == "TEST_ Coffee Spot"
        print("✓ Business profile persistence OK")


# ============================
# Caption Generation
# ============================
class TestGenerate:
    """Caption and image generation tests (optionalAuth)"""

    def test_generate_caption_no_auth(self, client):
        """Caption endpoint works without auth"""
        r = client.post(f"{BASE_URL}/api/generate/caption", json={
            "description": "Fresh espresso and pastries",
            "template": "today-special",
            "businessName": "TEST_ Coffee",
            "businessType": "cafe",
            "brandStyle": "clean"
        })
        assert r.status_code == 200, f"Caption gen failed: {r.text}"
        data = r.json()
        assert "caption" in data
        assert isinstance(data["caption"], str)
        assert len(data["caption"]) > 0
        print(f"✓ Caption generation OK: {data['caption'][:60]}...")

    def test_generate_caption_with_auth(self, auth_client):
        """Caption endpoint works with auth too"""
        r = auth_client.post(f"{BASE_URL}/api/generate/caption", json={
            "description": "New pasta dish launch",
            "template": "new-item",
            "businessName": "TEST_ Restaurant",
            "businessType": "restaurant",
            "brandStyle": "bold"
        })
        assert r.status_code == 200, f"Caption gen failed: {r.text}"
        data = r.json()
        assert "caption" in data
        print("✓ Caption generation with auth OK")

    def test_generate_image(self, auth_client):
        """Image gen returns null (MockAI) but 200"""
        r = auth_client.post(f"{BASE_URL}/api/generate/image", json={
            "photo": "dGVzdA==",  # base64 "test"
            "template": "today-special",
            "businessName": "TEST_ Restaurant",
            "businessType": "restaurant",
            "brandStyle": "clean",
            "description": "Test dish"
        })
        assert r.status_code == 200, f"Image gen failed: {r.text}"
        data = r.json()
        assert "processed_image" in data
        print(f"✓ Image generation OK: processed_image = {data['processed_image']}")


# ============================
# Posts CRUD
# ============================
class TestPosts:
    """Posts CRUD tests - requires auth"""

    @pytest.fixture(scope="class")
    def created_post_id(self, auth_client):
        """Create a test post and return its ID"""
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "today-special",
            "description": "TEST_ special pasta carbonara",
            "caption": "TEST_ Amazing pasta tonight! 🍝 #local",
            "platforms": ["instagram"],
            "status": "draft"
        })
        assert r.status_code == 201, f"Post creation failed: {r.status_code} - {r.text}"
        data = r.json()
        assert "id" in data
        post_id = data["id"]
        print(f"✓ Post created OK: {post_id}")
        return post_id

    def test_create_post(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "auto",
            "description": "TEST_ Draft test post",
            "caption": "TEST_ Test caption for draft",
            "platforms": ["instagram"],
            "status": "draft"
        })
        assert r.status_code == 201, f"Post creation failed: {r.text}"
        data = r.json()
        assert "id" in data
        assert data.get("status") == "draft"
        print("✓ Post creation OK")

    def test_list_posts(self, auth_client, created_post_id):
        r = auth_client.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200, f"List posts failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"✓ List posts OK - {len(data)} posts")

    def test_get_single_post(self, auth_client, created_post_id):
        r = auth_client.get(f"{BASE_URL}/api/posts/{created_post_id}")
        assert r.status_code == 200, f"Get post failed: {r.text}"
        data = r.json()
        assert data.get("id") == created_post_id
        print(f"✓ Get post OK: {created_post_id}")

    def test_filter_posts_by_status(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/posts?status=draft")
        assert r.status_code == 200, f"Filter posts failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        for p in data:
            assert p["status"] == "draft", f"Expected draft, got {p['status']}"
        print(f"✓ Filter by status OK - {len(data)} drafts")

    def test_publish_post(self, auth_client, created_post_id):
        r = auth_client.post(f"{BASE_URL}/api/posts/{created_post_id}/publish", json={
            "platforms": ["instagram"]
        })
        assert r.status_code == 200, f"Publish failed: {r.text}"
        data = r.json()
        assert data.get("success") is True
        print(f"✓ Post publish OK: {data}")

    def test_delete_post(self, auth_client, created_post_id):
        r = auth_client.delete(f"{BASE_URL}/api/posts/{created_post_id}")
        assert r.status_code == 200, f"Delete post failed: {r.text}"
        print(f"✓ Post delete OK")

    def test_posts_require_auth(self, client):
        """Posts endpoint should return 401 without auth"""
        r = requests.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("✓ Posts auth enforcement OK")


# ============================
# Social Accounts
# ============================
class TestSocial:
    """Social account connect/disconnect tests"""

    def test_get_social_accounts(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/social")
        assert r.status_code == 200, f"Get social accounts failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"✓ Get social accounts OK: {data}")

    def test_connect_instagram(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/social/connect", json={
            "platform": "instagram",
            "handle": "@testcafe_ig"
        })
        assert r.status_code == 200, f"Connect failed: {r.text}"
        data = r.json()
        assert data.get("success") is True or "platform" in data
        print("✓ Connect Instagram OK")

    def test_disconnect_instagram(self, auth_client):
        r = auth_client.delete(f"{BASE_URL}/api/social/disconnect/instagram")
        assert r.status_code == 200, f"Disconnect failed: {r.text}"
        data = r.json()
        assert data.get("success") is True
        print("✓ Disconnect Instagram OK")

    def test_social_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/social")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("✓ Social auth enforcement OK")


# ============================
# Subscription
# ============================
class TestSubscription:
    """Subscription status and upgrade tests"""

    def test_get_subscription_status(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/subscription/status")
        assert r.status_code == 200, f"Subscription status failed: {r.text}"
        data = r.json()
        assert "status" in data
        assert data["status"] in ["trial", "subscribed", "expired"]
        print(f"✓ Subscription status OK: {data}")

    def test_upgrade_subscription(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/subscription/upgrade", json={})
        assert r.status_code == 200, f"Upgrade failed: {r.text}"
        data = r.json()
        assert data.get("success") is True or "status" in data
        print(f"✓ Subscription upgrade OK: {data}")

    def test_subscription_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/subscription/status")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("✓ Subscription auth enforcement OK")
