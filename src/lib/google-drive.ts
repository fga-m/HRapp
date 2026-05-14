const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";

// Find or create a folder by name under a parent
async function findOrCreateFolder(
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

// Share a Drive file with a user (reader)
export async function shareFileWithUser(
  accessToken: string,
  fileId: string,
  email: string
): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "user",
      emailAddress: email,
    }),
  });
}
