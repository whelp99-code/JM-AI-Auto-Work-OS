from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

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
                    headers_map = {
                        h.get("name", "").casefold(): h.get("value", "") for h in headers_list
                    }
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
class GoogleCalendarConnector:
    access_token: str
    base_url: str = "https://www.googleapis.com/calendar/v3"

    def sync_events(
        self,
        calendar_id: str = "primary",
        sync_token: str | None = None,
        client: httpx.Client | None = None,
    ) -> tuple[list[Item], str | None]:
        own = client is None
        client = client or httpx.Client(timeout=30)
        headers = {"Authorization": f"Bearer {self.access_token}"}
        base = f"{self.base_url}/calendars/{quote(calendar_id, safe='')}/events"
        page_token: str | None = None
        next_sync_token: str | None = None
        items: list[Item] = []
        try:
            while True:
                params: dict[str, Any] = {"maxResults": 2500}
                if sync_token:
                    params["syncToken"] = sync_token
                if page_token:
                    params["pageToken"] = page_token
                response = client.get(base, headers=headers, params=params)
                response.raise_for_status()
                payload = response.json()
                for event in payload.get("items", []):
                    if event.get("status") == "cancelled":
                        continue
                    event_id = str(event.get("id", ""))
                    description = str(event.get("description", ""))
                    location = str(event.get("location", ""))
                    body = "\n".join(part for part in (description, location) if part)
                    items.append(
                        Item(
                            "google-calendar",
                            event_id,
                            f"gcal://{calendar_id}/event/{event_id}",
                            str(event.get("summary", "")),
                            body,
                        )
                    )
                page_token = payload.get("nextPageToken")
                if page_token:
                    continue
                next_sync_token = payload.get("nextSyncToken")
                break
            return items, next_sync_token
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

    def iter_mail_folder_delta(
        self,
        folder_id: str,
        delta_url: str | None = None,
        client: httpx.Client | None = None,
    ) -> tuple[list[Item], str | None]:
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
                    raw_body = message.get("body")
                    body = raw_body.get("content", "") if isinstance(raw_body, dict) else ""
                    items.append(
                        Item(
                            "outlook",
                            message_id,
                            f"outlook://message/{message_id}",
                            str(message.get("subject", "")),
                            body,
                        )
                    )
                last_delta = payload.get("@odata.deltaLink") or last_delta
            return items, last_delta
        finally:
            if own:
                client.close()

    def iter_calendar_delta(
        self,
        start: str,
        end: str,
        delta_url: str | None = None,
        client: httpx.Client | None = None,
    ) -> tuple[list[Item], str | None]:
        own = client is None
        client = client or httpx.Client(timeout=30)
        url = (
            delta_url
            or f"{self.base_url}/me/calendarView/delta?startDateTime={start}&endDateTime={end}"
        )
        items: list[Item] = []
        last_delta: str | None = None
        try:
            for payload in self._pages(url, client):
                for event in payload.get("value", []):
                    if "@removed" in event:
                        continue
                    event_id = str(event.get("id", ""))
                    body = str(event.get("bodyPreview", ""))
                    items.append(
                        Item(
                            "microsoft-calendar",
                            event_id,
                            f"outlook://calendar/{event_id}",
                            str(event.get("subject", "")),
                            body,
                        )
                    )
                last_delta = payload.get("@odata.deltaLink") or last_delta
            return items, last_delta
        finally:
            if own:
                client.close()
