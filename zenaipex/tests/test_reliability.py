from fastapi.testclient import TestClient

from zenaipex.main import app


def test_request_id_is_generated_and_returned():
    with TestClient(app) as client:
        response = client.get("/", headers={"X-Request-ID": "trace-test-01"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "trace-test-01"


def test_unsafe_request_id_is_replaced():
    with TestClient(app) as client:
        response = client.get("/", headers={"X-Request-ID": "bad id\nvalue"})

    request_id = response.headers["X-Request-ID"]
    assert response.status_code == 200
    assert request_id != "bad id\nvalue"
    assert len(request_id) == 32
