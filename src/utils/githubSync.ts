// Unicode-safe Base64 encoding/decoding helpers
export function safeBtoa(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch (e) {
    console.error('safeBtoa error:', e);
    return btoa(str);
  }
}

export function safeAtob(str: string): string {
  try {
    const cleanStr = str.replace(/\s/g, '');
    return decodeURIComponent(
      atob(cleanStr)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    console.error('safeAtob error:', e);
    return atob(str);
  }
}

// Packs local storage data starting with "trcapital_" (excluding cloud sync configs) into a single object
export function packLocalData(): Record<string, string> {
  const data: Record<string, string> = {};
  const excludeKeys = [
    'trcapital_github_token',
    'trcapital_github_repo',
    'trcapital_github_enabled',
    'trcapital_sidebar_collapsed'
  ];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('trcapital_users') || key.startsWith('trcapital_user_'))) {
      if (!excludeKeys.includes(key)) {
        const val = localStorage.getItem(key);
        if (val) {
          data[key] = val;
        }
      }
    }
  }
  return data;
}

// Unpacks data and writes to localStorage
export function unpackLocalData(data: Record<string, string>): boolean {
  if (!data || typeof data !== 'object') return false;
  let updated = false;

  for (const key in data) {
    const val = data[key];
    if (localStorage.getItem(key) !== val) {
      localStorage.setItem(key, val);
      updated = true;
    }
  }
  return updated;
}

// GitHub API Headers generator
function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

// Verifies connectivity to the GitHub repository
export async function verifyTokenAndRepo(token: string, repo: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: getHeaders(token)
    });
    return res.ok;
  } catch (e) {
    console.error('verifyTokenAndRepo failed:', e);
    return false;
  }
}

// Ensures the db-sync branch exists. If not, creates it pointing to the latest commit on main/master.
export async function ensureDBSyncBranch(token: string, repo: string): Promise<boolean> {
  const headers = getHeaders(token);
  
  try {
    // 1. Check if db-sync branch already exists
    const dbSyncCheck = await fetch(`https://api.github.com/repos/${repo}/branches/db-sync`, { headers });
    if (dbSyncCheck.ok) {
      return true;
    }

    // 2. Fetch main branch ref to get latest commit SHA
    let mainRefRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers });
    if (!mainRefRes.ok) {
      // Fallback: check master branch
      mainRefRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/master`, { headers });
    }
    
    if (!mainRefRes.ok) {
      throw new Error('Unable to find main or master branch to branch off of.');
    }

    const mainRefData = await mainRefRes.json();
    const mainSha = mainRefData.object.sha;

    // 3. Create the db-sync branch pointing to that SHA
    const createRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: 'refs/heads/db-sync',
        sha: mainSha
      })
    });

    return createRefRes.ok;
  } catch (e) {
    console.error('ensureDBSyncBranch failed:', e);
    return false;
  }
}

// Pulls database file from GitHub db-sync branch
export async function fetchDatabaseFromGitHub(
  token: string,
  repo: string
): Promise<{ data: Record<string, string>; sha: string } | null> {
  const headers = getHeaders(token);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/trcapital_db.json?ref=db-sync`,
      { headers }
    );

    if (res.status === 404) {
      // Database file doesn't exist yet on the branch
      return { data: {}, sha: '' };
    }

    if (!res.ok) {
      throw new Error(`GitHub responded with code ${res.status}`);
    }

    const fileMeta = await res.json();
    const rawContent = safeAtob(fileMeta.content);
    const data = JSON.parse(rawContent);

    return {
      data,
      sha: fileMeta.sha
    };
  } catch (e) {
    console.error('fetchDatabaseFromGitHub failed:', e);
    return null;
  }
}

// Pushes database file to GitHub db-sync branch
export async function pushDatabaseToGitHub(
  token: string,
  repo: string,
  data: Record<string, string>,
  sha?: string
): Promise<string | null> {
  const headers = getHeaders(token);
  const serialized = JSON.stringify(data, null, 2);
  const b64 = safeBtoa(serialized);

  try {
    const payload: any = {
      message: 'sync: automated database update',
      content: b64,
      branch: 'db-sync'
    };

    if (sha) {
      payload.sha = sha;
    }

    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/trcapital_db.json`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      // If we got a conflict (e.g. 409 conflict, SHA mismatch)
      if (res.status === 409) {
        console.warn('Conflict detected during push, fetch required.');
      }
      throw new Error(`GitHub responded with status ${res.status}`);
    }

    const responseData = await res.json();
    return responseData.content.sha;
  } catch (e) {
    console.error('pushDatabaseToGitHub failed:', e);
    return null;
  }
}
