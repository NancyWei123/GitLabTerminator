export type GitHubRepoInfo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch?: string;
  owner: string;
  repo: string;
};

export type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
};

const parseGitHubUrl = (repoUrl: string) => {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "");

  const match = cleanUrl.match(/github\.com[/:]([^/]+)\/([^/#?]+)/);

  if (!match) {
    throw new Error("Invalid GitHub repository URL.");
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
};

const githubHeaders = (token: string, accept = "application/vnd.github+json") => {
  return {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token.trim() ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const throwGitHubError = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  throw new Error(data?.message || fallback);
};

export const getGitHubRepo = async (
  repoUrl: string,
  token: string
): Promise<GitHubRepoInfo> => {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: githubHeaders(token),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to fetch GitHub repository.");
  }

  const data = await response.json();

  return {
    id: data.id,
    name: data.name,
    full_name: data.full_name,
    description: data.description,
    html_url: data.html_url,
    default_branch: data.default_branch,
    owner,
    repo,
  };
};

export const getGitHubRepositoryTree = async (
  owner: string,
  repo: string,
  token: string,
  branch: string
): Promise<GitHubTreeItem[]> => {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch
    )}?recursive=1`,
    {
      headers: githubHeaders(token),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to fetch GitHub repository tree.");
  }

  const data = await response.json();

  return data.tree || [];
};

export const getGitHubRawFile = async (
  owner: string,
  repo: string,
  token: string,
  filePath: string,
  branch: string
): Promise<string> => {
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
      branch
    )}`,
    {
      headers: githubHeaders(token, "application/vnd.github.raw"),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, `Failed to fetch file: ${filePath}`);
  }

  return response.text();
};

export const createGitHubIssue = async (
  owner: string,
  repo: string,
  token: string,
  title: string,
  description: string
) => {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: description,
      }),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to create GitHub issue.");
  }

  return response.json();
};