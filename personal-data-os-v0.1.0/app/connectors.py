from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

import httpx

from app.core import Item


@dataclass
class GmailConnector:
    access_token: str
    base_url: str = "https://gmail.googleapis.com/gmail/v1"

    def iter_messages(self, client: httpx.Client | None = None) -> Iterable[Item]:
        own = client is None
        client = client or httpx.Client(timeout=30)
        headers = {"Authorization": f"Bearer {self.access_token}"}
        page_token: str | None = None
        try:
            while True:
                params: dict[str, Any] = {"maxResults": 500}
                if page_token:
                    params["pageToken"] = page_token
                listing = client.get(f"{self.base_url}/users/me/messages", headers=headers, params=params)
                listing.raise_for_status()
                payload = listing.json()
                for summary in payload.get("messages", []):
                    message_id = summary["id"]
                    response = client.get(
                        f"{self.base_url}/users/me/messages/{message_id}",
                        headers=headers,
                        params={"format": "full"},
                    )
                    response.raise_for_status()
                    message = response.json()
                    headers_list = message.get("payload", {}).get("headers", [])
                    headers_map = {h.get("name", "").casefold(): h.get("value", "") for h in headers_list}
                    yield Item(
                        source_type="gmail",
                        source_id=message_id,
                        locator=f"gmail://message/{message_id}",
                        title=headers_map.get("subject", ""),
                        body=message.get("snippet", ""),
                    )
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break
        finally:
            if own:
                client.close()


@dataclass
class MicrosoftGraphConnector:
    access_token: str
    base_url: str = "https://graph.microsoft.com/v1.0"

    def _pages(self, url: str, client: httpx.Client) -> Iterable[dict[str, Any]]:
        headers = {"Authorization": f"Bearer {self.access_token}"}
        next_url: str | None = url
        while next_url:
            response = client.get(next_url, headers=headers)
            response.raise_for_status()
            payload = response.json()
            yield payload
            next_url = payload.get("@odata.nextLink")

    def iter_mail_folder_delta(self, folder_id: str, delta_url: str | None = None, client: httpx.Client | None = None) -> tuple[list[Item], str | None]:
        own = client is None
        client = client or httpx.Client(timeout=30)
        start = delta_url or f"{self.base_url}/me/mailFolders/{folder_id}/messages/delta"
        items: list[Item] = []
        last_delta: str | None = None
        try:
            for payload in self._pages(start, client):
                for message in payload.get("value", []):
                    if "@removed" in message:
                        continue
                    message_id = str(message.get("id", ""))
                    body = message.get("body", {}).get("content", "") if isinstance(message.get("body"), dict) else ""
                    items.append(Item("outlook", message_id, f"outlook://message/{message_id}", str(message.get("subject", "")), body))
                last_delta = payload.get("@odata.deltaLink") or last_delta
            return items, last_delta
        finally:
            if own:
                client.close()

    def iter_calendar_delta(self, start: str, end: str, delta_url: str | None = None, client: httpx.Client | None = None) -> tuple[list[Item], str | None]:
        own = client is None
        client = client or httpx.Client(timeout=30)
        url = delta_url or f"{self.base_url}/me/calendarView/delta?startDateTime={start}&endDateTime={end}"
        items: list[Item] = []
        last_delta: str | None = None
        try:
            for payload in self._pages(url, client):
                for event in payload.get("value", []):
                    if "@removed" in event:
                        continue
                    event_id = str(event.get("id", ""))
                    body = event.get("bodyPreview", "")
                    items.append(Item("microsoft-calendar", event_id, f"outlook://calendar/{event_id}", str(event.get("subject", "")), body))
                last_delta = payload.get("@odata.deltaLink") or last_delta
            return items, last_delta
        finally:
            if own:
                client.close()
