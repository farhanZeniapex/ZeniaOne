from fastapi.testclient import TestClient

from zenaipex.main import app


def test_request_id_is_generated_and_returned():
    # Do not enter the lifespan here: this middleware test does not need a
    # database connection and must remain runnable in a dependency-free CI job.
    client = TestClient(app)
    response = client.get("/", headers={"X-Request-ID": "trace-test-01"})
    client.close()

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "trace-test-01"


def test_unsafe_request_id_is_replaced():
    client = TestClient(app)
    response = client.get("/", headers={"X-Request-ID": "bad id\nvalue"})
    client.close()

    request_id = response.headers["X-Request-ID"]
    assert response.status_code == 200
    assert request_id != "bad id\nvalue"
    assert len(request_id) == 32
