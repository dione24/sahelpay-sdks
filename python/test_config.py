from sahelpay import Client


def test_sandbox_environment_uses_api_host():
    client = Client(secret_key="sk_test_123", environment="sandbox")

    assert client._base_url == "https://api.sahelpay.ml"
