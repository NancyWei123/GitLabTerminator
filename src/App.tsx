import { useState } from "react";
import {
  getProjectId,
  getRepositoryTree,
  getRawFile,
  createGitLabIssue,
} from "./api/gitlab";
import { askGemini } from "./api/gemini";

type SuggestedIssue = {
  title: string;
  description: string;
};

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [issues, setIssues] = useState<SuggestedIssue[]>([]);

  const analyseRepo = async () => {
    try {
      setLoading(true);
      setExplanation("");
      setIssues([]);

      const project = await getProjectId(repoUrl, gitlabToken);
      setProjectId(project.id);

      const tree = await getRepositoryTree(project.id, gitlabToken);

      const importantFiles = tree
        .filter((item) => item.type === "blob")
        .filter((item) => {
          const path = item.path.toLowerCase();

          return (
            path === "readme.md" ||
            path === "package.json" ||
            path === "requirements.txt" ||
            path === "pom.xml" ||
            path === "build.gradle" ||
            path.startsWith("src/") ||
            path.startsWith("app/")
          );
        })
        .slice(0, 12);

      const files = [];

      for (const file of importantFiles) {
        const content = await getRawFile(
          project.id,
          file.path,
          gitlabToken,
          project.default_branch || "main"
        );

        if (content.trim()) {
          files.push({
            path: file.path,
            content: content.slice(0, 5000),
          });
        }
      }

      const prompt = `
You are an AI GitLab repository assistant.

Analyse this repository and return:

1. Simple project explanation
2. Tech stack
3. Main folder/file structure
4. How a beginner can run this project
5. 5 suggested GitLab issues
6. For each issue:
   - title
   - why it matters
   - how to fix it
   - difficulty: easy / medium / hard

Repository name:
${project.name}

Repository description:
${project.description || "No description"}

Files:
${files
  .map(
    (file) => `
--- FILE: ${file.path} ---
${file.content}
`
  )
  .join("\n")}
`;

      const result = await askGemini(geminiKey, prompt);
      setExplanation(result);

      const issuePrompt = `
Based on this repository analysis, create exactly 5 GitLab issues.

Return ONLY valid JSON.
No markdown.

Format:
[
  {
    "title": "Issue title",
    "description": "Detailed issue description with fix steps"
  }
]

Repository analysis:
${result}
`;

      const issueJson = await askGemini(geminiKey, issuePrompt);

      const cleaned = issueJson
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      setIssues(JSON.parse(cleaned));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (issue: SuggestedIssue) => {
    if (!projectId) return;

    try {
      await createGitLabIssue(
        projectId,
        gitlabToken,
        issue.title,
        issue.description
      );

      alert("Issue created in GitLab!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create issue.");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>GitTerminator</h1>
      <p>Paste a GitLab repo link. I will explain it and suggest fixable issues.</p>

      <input
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        placeholder="GitLab repo URL"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />

      <input
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        placeholder="GitLab token"
        type="password"
        value={gitlabToken}
        onChange={(e) => setGitlabToken(e.target.value)}
      />

      <input
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        placeholder="Gemini API key"
        type="password"
        value={geminiKey}
        onChange={(e) => setGeminiKey(e.target.value)}
      />

      <button onClick={analyseRepo} disabled={loading}>
        {loading ? "Analysing..." : "Analyse Repository"}
      </button>

      {explanation && (
        <div style={{ marginTop: 30 }}>
          <h2>Repository Explanation</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 16 }}>
            {explanation}
          </pre>
        </div>
      )}

      {issues.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2>Suggested Issues</h2>

          {issues.map((issue, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #ddd",
                padding: 16,
                marginBottom: 12,
                borderRadius: 8,
              }}
            >
              <h3>{issue.title}</h3>
              <p>{issue.description}</p>

              <button onClick={() => handleCreateIssue(issue)}>
                Create Issue in GitLab
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;