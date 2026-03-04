"""
PostSnap Schedule Feature Tests - Iteration 4
Tests for:
- POST /api/posts with scheduledAt field and 'scheduled' status
- GET /api/posts returns scheduledAt field in response
- GET /api/posts?status=scheduled filters correctly
- Upsert existing draft to scheduled status
- scheduledAt persists after update
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

TS = str(int(time.time()))
TEST_EMAIL = f"TEST_sched_{TS}@testpostsnap.com"
TEST_PASSWORD = "testpass_sched_123!"

# Future date for scheduling (1 hour from now)
FUTURE_ISO = time.strftime(
    '%Y-%m-%dT%H:%M:%S.000Z',
    time.gmtime(time.time() + 3600)
)


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(client):
    """Register a fresh user for schedule tests"""
    r = client.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if r.status_code == 201:
        return r.json()["token"]
    # Fallback to login
    r2 = client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert r2.status_code == 200, f"Login failed: {r2.status_code} - {r2.text}"
    return r2.json()["token"]


@pytest.fixture(scope="module")
def auth_client(client, auth_token):
    """Authenticated session"""
    client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return client


# ==================================================
# Scheduled Post Creation
# ==================================================
class TestScheduledPostCreation:
    """Test creating posts with scheduledAt and status='scheduled'"""

    def test_create_scheduled_post_with_scheduledAt(self, auth_client):
        """POST /api/posts with status=scheduled and scheduledAt should return 201"""
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "today-special",
            "description": "TEST_ scheduled post for later",
            "caption": "TEST_ Great specials tonight! 🍝 #local",
            "platforms": ["instagram"],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
        })
        assert r.status_code == 201, f"Scheduled post creation failed: {r.status_code} - {r.text}"
        data = r.json()
        assert "id" in data, "Response must contain 'id'"
        assert data.get("status") == "scheduled", f"Expected 'scheduled' status, got: {data.get('status')}"
        assert data.get("scheduledAt") is not None, "scheduledAt must be present in response"
        assert FUTURE_ISO[:10] in data.get("scheduledAt", ""), f"scheduledAt date mismatch: {data.get('scheduledAt')}"
        print(f"✓ Scheduled post created: id={data['id']}, scheduledAt={data.get('scheduledAt')}")

    def test_create_scheduled_post_no_platforms(self, auth_client):
        """Scheduled post with no platforms should still be created"""
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "promo",
            "description": "TEST_ scheduled no platform",
            "caption": "TEST_ Weekend sale! 💸",
            "platforms": [],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
        })
        assert r.status_code == 201, f"Expected 201: {r.status_code} - {r.text}"
        data = r.json()
        assert data.get("status") == "scheduled"
        print("✓ Scheduled post (no platforms) created OK")

    def test_create_scheduled_post_returns_scheduledAt(self, auth_client):
        """Verify scheduledAt field is preserved correctly in response"""
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "auto",
            "description": "TEST_ scheduledAt persistence check",
            "caption": "TEST_ Check scheduledAt!",
            "platforms": ["instagram", "facebook"],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
        })
        assert r.status_code == 201, f"Failed: {r.status_code} - {r.text}"
        data = r.json()
        assert data.get("scheduledAt") is not None, "scheduledAt is null or missing in response"
        print(f"✓ scheduledAt in response: {data.get('scheduledAt')}")

    def test_create_draft_post_no_scheduledAt(self, auth_client):
        """Draft post should have scheduledAt as null"""
        r = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "auto",
            "description": "TEST_ normal draft post",
            "caption": "TEST_ Just a draft",
            "platforms": ["instagram"],
            "status": "draft",
        })
        assert r.status_code == 201, f"Failed: {r.status_code} - {r.text}"
        data = r.json()
        assert data.get("status") == "draft"
        # scheduledAt should be absent or null for a draft
        scheduled_val = data.get("scheduledAt")
        assert scheduled_val is None, f"Draft should not have scheduledAt, got: {scheduled_val}"
        print("✓ Draft post has null scheduledAt OK")


# ==================================================
# List / Filter Posts with 'scheduled' status
# ==================================================
class TestScheduledPostFilter:
    """Test listing/filtering posts by scheduled status"""

    @pytest.fixture(scope="class", autouse=True)
    def create_seed_posts(self, auth_client):
        """Create scheduled + draft posts for filter testing"""
        # Create a scheduled post
        r1 = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "promo",
            "description": "TEST_ seed scheduled post",
            "caption": "TEST_ Seed scheduled caption",
            "platforms": ["instagram"],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
        })
        assert r1.status_code == 201, f"Seed scheduled post failed: {r1.text}"
        print(f"✓ Seed scheduled post created: {r1.json()['id']}")

        # Create a draft post
        r2 = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "auto",
            "description": "TEST_ seed draft post",
            "caption": "TEST_ Seed draft caption",
            "platforms": ["instagram"],
            "status": "draft",
        })
        assert r2.status_code == 201, f"Seed draft post failed: {r2.text}"
        print(f"✓ Seed draft post created: {r2.json()['id']}")
        yield

    def test_list_all_posts_includes_scheduled(self, auth_client):
        """GET /api/posts should include scheduled posts"""
        r = auth_client.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200, f"List posts failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        statuses = [p.get("status") for p in data]
        assert "scheduled" in statuses, f"Expected at least one 'scheduled' post, statuses: {statuses}"
        print(f"✓ All posts include scheduled: statuses={set(statuses)}")

    def test_filter_posts_by_scheduled_status(self, auth_client):
        """GET /api/posts?status=scheduled returns only scheduled posts"""
        r = auth_client.get(f"{BASE_URL}/api/posts?status=scheduled")
        assert r.status_code == 200, f"Filter by scheduled failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one scheduled post"
        for p in data:
            assert p.get("status") == "scheduled", f"Expected 'scheduled', got: {p.get('status')}"
            assert p.get("scheduledAt") is not None, f"Scheduled post should have scheduledAt: {p}"
        print(f"✓ Filter by scheduled OK: {len(data)} scheduled posts, all have scheduledAt")

    def test_filter_drafts_excludes_scheduled(self, auth_client):
        """GET /api/posts?status=draft should not return scheduled posts"""
        r = auth_client.get(f"{BASE_URL}/api/posts?status=draft")
        assert r.status_code == 200, f"Filter by draft failed: {r.text}"
        data = r.json()
        for p in data:
            assert p.get("status") == "draft", f"Expected 'draft', got: {p.get('status')}"
        print(f"✓ Draft filter excludes scheduled OK: {len(data)} drafts")

    def test_scheduled_posts_have_scheduledAt_field(self, auth_client):
        """All scheduled posts returned by the API must have scheduledAt field"""
        r = auth_client.get(f"{BASE_URL}/api/posts?status=scheduled")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0, "No scheduled posts found to check"
        for p in data:
            assert "scheduledAt" in p, f"Post {p.get('id')} missing scheduledAt field"
            assert p["scheduledAt"] is not None, f"Post {p.get('id')} has null scheduledAt"
        print(f"✓ All scheduled posts have scheduledAt: {len(data)} posts checked")


# ==================================================
# Upsert draft → scheduled
# ==================================================
class TestDraftToScheduledUpsert:
    """Test converting a draft post to scheduled via POST (upsert)"""

    def test_upsert_draft_to_scheduled(self, auth_client):
        """Create a draft, then upsert it to scheduled with scheduledAt"""
        # Step 1: Create draft
        r1 = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "today-special",
            "description": "TEST_ upsert draft",
            "caption": "TEST_ Will be scheduled",
            "platforms": ["instagram"],
            "status": "draft",
        })
        assert r1.status_code == 201, f"Draft creation failed: {r1.text}"
        draft_id = r1.json()["id"]
        assert draft_id, "Draft must have an id"
        print(f"✓ Draft created: {draft_id}")

        # Step 2: Upsert to scheduled
        r2 = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "today-special",
            "description": "TEST_ upsert draft",
            "caption": "TEST_ Will be scheduled",
            "platforms": ["instagram"],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
            "postId": draft_id,
        })
        assert r2.status_code == 201, f"Upsert to scheduled failed: {r2.status_code} - {r2.text}"
        updated = r2.json()
        assert updated.get("status") == "scheduled", f"Expected 'scheduled', got: {updated.get('status')}"
        assert updated.get("scheduledAt") is not None, "scheduledAt should be set after upsert"
        print(f"✓ Upsert draft→scheduled OK: status={updated['status']}, scheduledAt={updated.get('scheduledAt')}")

        # Step 3: GET to verify persistence
        r3 = auth_client.get(f"{BASE_URL}/api/posts/{draft_id}")
        assert r3.status_code == 200, f"Get post failed: {r3.text}"
        fetched = r3.json()
        assert fetched.get("status") == "scheduled", f"Persisted status should be 'scheduled', got: {fetched.get('status')}"
        assert fetched.get("scheduledAt") is not None, "scheduledAt should persist in database"
        print(f"✓ Upsert persistence verified in DB: {fetched['id']}")


# ==================================================
# scheduledAt in GET /api/posts/:id
# ==================================================
class TestScheduledPostGetById:
    """Test that GET /api/posts/:id returns scheduledAt"""

    def test_get_scheduled_post_by_id(self, auth_client):
        """Create a scheduled post and retrieve by id - verify scheduledAt is present"""
        r1 = auth_client.post(f"{BASE_URL}/api/posts", json={
            "template": "auto",
            "description": "TEST_ scheduled getById",
            "caption": "TEST_ GetById test",
            "platforms": ["facebook"],
            "status": "scheduled",
            "scheduledAt": FUTURE_ISO,
        })
        assert r1.status_code == 201
        post_id = r1.json()["id"]

        r2 = auth_client.get(f"{BASE_URL}/api/posts/{post_id}")
        assert r2.status_code == 200, f"Get by id failed: {r2.text}"
        data = r2.json()
        assert data.get("id") == post_id
        assert data.get("status") == "scheduled"
        assert data.get("scheduledAt") is not None, f"scheduledAt missing in GET by id response: {data}"
        print(f"✓ GET /api/posts/:id returns scheduledAt: {data.get('scheduledAt')}")
