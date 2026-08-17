import httpx

from app.connectors import GmailConnector, GoogleCalendarConnector, MicrosoftGraphConnector


def test_gmail_list_get_contract() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages"):
            return httpx.Response(200, json={"messages": [{"id": "m1"}]})
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "snippet": "hello",
                "payload": {"headers": [{"name": "Subject", "value": "Test"}]},
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items = list(GmailConnector("secret").iter_messages(client))
    assert len(items) == 1
    assert items[0].source_id == "m1"
    assert items[0].title == "Test"


def test_google_calendar_incremental_contract() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "e1",
                        "summary": "Meeting",
                        "description": "Discuss project",
                        "location": "Seoul",
                    }
                ],
                "nextSyncToken": "sync-2",
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, sync_token = GoogleCalendarConnector("secret").sync_events(
            "primary", "sync-1", client
        )
    assert [item.source_id for item in items] == ["e1"]
    assert sync_token == "sync-2"
    assert requests[0].url.params.get("syncToken") == "sync-1"


def test_graph_delta_contract() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "value": [{"id": "m1", "subject": "Hi", "body": {"content": "Body"}}],
                "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-token",
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, delta = MicrosoftGraphConnector("secret").iter_mail_folder_delta(
            "inbox", client=client
        )
    assert [item.source_id for item in items] == ["m1"]
    assert delta and "delta-token" in delta
