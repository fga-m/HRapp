const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";

// Find or create a folder by name under a parent
export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${encodeURIComponent(name)}' and mimeType='application/vnd.google-apps.folder'${parentQuery} and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : [],
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

// Create a Google Doc with content in the right folder
export async function createMeetingDoc({
  accessToken,
  meetingType,
  staffName,
  date,
  title,
  content,
}: {
  accessToken: string;
  meetingType: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  // Format: DD/MM/YY
  const [year, month, day] = date.split("-");
  const formattedDate = `${day}/${month}/${year.slice(2)}`;
  const fileName = `${formattedDate} - ${title}`;

  const typeLabels: Record<string, string> = {
    "1on1": "1-on-1",
    team: "Team Meeting",
    performance_review: "Performance Review",
    projects_goals: "Projects & Goals",
  };
  const typeLabel = typeLabels[meetingType] || meetingType;

  // Build folder structure: Meeting Notes → [Type] → [Staff Name]
  const rootFolderId = await findOrCreateFolder(accessToken, "Meeting Notes");
  const typeFolderId = await findOrCreateFolder(accessToken, typeLabel, rootFolderId);
  const staffFolderId = await findOrCreateFolder(accessToken, staffName, typeFolderId);

  // Create the Google Doc
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: "application/vnd.google-apps.document",
      parents: [staffFolderId],
    }),
  });
  const file = await createRes.json();

  // Write content to the doc
  if (content) {
    await fetch(`${DOCS_API}/documents/${file.id}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      }),
    });
  }

  return {
    fileId: file.id,
    fileUrl: `https://docs.google.com/document/d/${file.id}/edit`,
  };
}

// ---------------------------------------------------------------------------
// Contract mail-merge: copy a Google Doc template, replace {{placeholders}}
// with per-employee values, and export the result as a PDF. All calls use the
// signed-in admin's own access token, so the template must be accessible to
// them (owned or shared).
// ---------------------------------------------------------------------------

/** Pull a Google Doc file id out of a share URL, or accept a bare id. */
export function parseGoogleDocId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  // A bare id (Drive ids are URL-safe base64-ish, no slashes/spaces).
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Collect every `textRun.content` string anywhere in a Docs document object
 *  (body, tables, headers, footers), so placeholder detection is exhaustive. */
function collectDocText(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectDocText(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const textRun = obj.textRun as { content?: unknown } | undefined;
    if (textRun && typeof textRun.content === "string") out.push(textRun.content);
    for (const value of Object.values(obj)) collectDocText(value, out);
  }
}

/** Read a template Doc and return its unique `{{placeholder}}` field names. */
export async function extractTemplateFields(
  accessToken: string,
  docId: string
): Promise<string[]> {
  const res = await fetch(`${DOCS_API}/documents/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Couldn't read the Google Doc (${res.status}).`);
  }
  const doc = await res.json();
  const parts: string[] = [];
  collectDocText(doc, parts);
  const text = parts.join("");

  const fields = new Set<string>();
  const re = /\{\{\s*([\w .-]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) fields.add(m[1]);
  return [...fields];
}

/** Copy a Doc (preserving its formatting) into a folder. */
export async function copyDoc(
  accessToken: string,
  templateDocId: string,
  name: string,
  parentFolderId?: string
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${DRIVE_API}/files/${templateDocId}/copy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      parents: parentFolderId ? [parentFolderId] : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`Couldn't copy the template (${res.status}).`);
  }
  const file = await res.json();
  return { id: file.id, url: `https://docs.google.com/document/d/${file.id}/edit` };
}

/** Replace every `{{field}}` in a Doc with its value (blank if missing). */
export async function fillDocPlaceholders(
  accessToken: string,
  docId: string,
  values: Record<string, string>
): Promise<void> {
  const requests = Object.entries(values).map(([field, value]) => ({
    replaceAllText: {
      containsText: { text: `{{${field}}}`, matchCase: true },
      replaceText: value ?? "",
    },
  }));
  if (requests.length === 0) return;

  const res = await fetch(`${DOCS_API}/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    throw new Error(`Couldn't fill the contract (${res.status}).`);
  }
}

/** Export a Doc as a PDF and return the bytes. */
export async function exportDocAsPdf(
  accessToken: string,
  docId: string
): Promise<Buffer> {
  const res = await fetch(
    `${DRIVE_API}/files/${docId}/export?mimeType=application/pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Couldn't export the contract as PDF (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Share a Drive file with a user (reader by default; pass "writer" to allow edits)
export async function shareFileWithUser(
  accessToken: string,
  fileId: string,
  email: string,
  role: "reader" | "writer" = "reader"
): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}/permissions?sendNotificationEmail=false`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      type: "user",
      emailAddress: email,
    }),
  });
}
