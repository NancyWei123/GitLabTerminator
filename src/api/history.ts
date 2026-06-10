import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export type ProjectIssue = {
  title: string;
  description: string;
};

export type ProjectHistory = {
  id?: string;
  projectName: string;
  repoUrl: string;
  keyword: string;
  techStack: string;
  level: string;
  levelText: string;
  explanation?: string;
  issueList?: ProjectIssue[];
  createdAt?: unknown;
};

export const saveProjectHistory = async (history: ProjectHistory) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please login first.");
  }

  const historyRef = collection(db, "users", user.uid, "history");

  await addDoc(historyRef, {
    projectName: history.projectName,
    repoUrl: history.repoUrl,
    keyword: history.keyword,
    techStack: history.techStack,
    level: history.level,
    levelText: history.levelText,
    explanation: history.explanation || "",
    issueList: history.issueList || [],
    userId: user.uid,
    userEmail: user.email,
    createdAt: serverTimestamp(),
  });
};

export const getProjectHistory = async (): Promise<ProjectHistory[]> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please login first.");
  }

  const historyRef = collection(db, "users", user.uid, "history");

  const q = query(historyRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  })) as ProjectHistory[];
};

export const deleteProjectHistory = async (historyId: string) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please login first.");
  }

  await deleteDoc(doc(db, "users", user.uid, "history", historyId));
};