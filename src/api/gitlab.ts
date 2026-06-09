export type GitLabTreeItem = {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
};

function getProjectPathFromUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname.replace(/^\/|\/$/g, "");
}

function encodeProjectId(projectPath: string): string {
  return encodeURIComponent(projectPath);
}

export async function getProjectId(repoUrl: string, token: string) {
  const projectPath = getProjectPathFromUrl(repoUrl);
  const encodedProject = encodeProjectId(projectPath);

  const res = await fetch(`https://gitlab.com/api/v4/projects/${encodedProject}`, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });

  if (!res.ok) {
    throw new Error("Cannot find GitLab project. Check repo link or token.");
  }

  return await res.json();
}

export async function getRepositoryTree(
  projectId: number,
  token: string
): Promise<GitLabTreeItem[]> {
  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/tree?recursive=true&per_page=100`,
    {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Cannot read repository tree.");
  }

  return await res.json();
}

export async function getRawFile(
  projectId: number,
  filePath: string,
  token: string,
  branch = "main"
): Promise<string> {
  const encodedFilePath = encodeURIComponent(filePath);

  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedFilePath}/raw?ref=${branch}`,
    {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    }
  );

  if (!res.ok) {
    return "";
  }

  return await res.text();
}

export async function createGitLabIssue(
  projectId: number,
  token: string,
  title: string,
  description: string
) {
  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/issues`,
    {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        labels: "ai-suggested,good-first-issue",
      }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to create GitLab issue.");
  }

  return await res.json();
}