import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { z } from "zod";
import { unzipSync } from "fflate";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  github: router({
    startBuild: publicProcedure
      .input(z.object({
        fileName: z.string(),
        content: z.string(), // base64
      }))
      .mutation(async ({ input }) => {
        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
        if (!token) throw new Error("GitHub token not configured");
        if (!input.fileName.toLowerCase().endsWith(".py")) throw new Error("Only Python files are supported");
        if (input.content.length > 8_000_000) throw new Error("The Python file is too large");
        const safeFileName = "build_input.py";
        const fileUrl = `https://api.github.com/repos/${repo}/contents/${safeFileName}`;
        const current = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        const currentData = current.ok ? await current.json() : null;

        // 1. Upload/Update the selected Python file in a fixed path
        const upload = await fetch(fileUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Upload ${safeFileName} for build`, content: input.content, branch: "main", ...(currentData?.sha ? { sha: currentData.sha } : {}) }),
        });
        if (!upload.ok) throw new Error("GitHub رفض رفع ملف Python");

        // 2. Trigger Workflow
        const trigger = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-windows.yml/dispatches`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
          body: JSON.stringify({ ref: "main" }),
        });

        if (trigger.status !== 204) throw new Error("Failed to trigger build workflow");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const runsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        const runsData = await runsResponse.json();
        const run = runsData.workflow_runs?.[0];
        return { success: true, runId: run?.id ?? null };
      }),

    startApkBuild: publicProcedure
      .mutation(async () => {
        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
        if (!token) throw new Error("GitHub token not configured");
        const trigger = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-apk.yml/dispatches`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main" }) });
        if (trigger.status !== 204) throw new Error("تعذر بدء بناء APK");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const runs = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-apk.yml/runs?per_page=1`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        const data = await runs.json();
        return { success: true, runId: data.workflow_runs?.[0]?.id ?? null };
      }),

    checkApkStatus: publicProcedure.query(async () => {
      const token = process.env.GITHUB_ACTIONS_TOKEN;
      const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
      if (!token) throw new Error("GitHub token not configured");
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-apk.yml/runs?per_page=1`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error("تعذر قراءة حالة بناء APK");
      const data = await response.json();
      const run = data.workflow_runs?.[0];
      if (!run) return { status: "no_runs" };
      let downloadUrl = null;
      if (run.status === "completed" && run.conclusion === "success") {
        const artifacts = await fetch(run.artifacts_url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        const artifactData = await artifacts.json();
        downloadUrl = artifactData.artifacts?.[0]?.archive_download_url || null;
      }
      return { status: run.status, conclusion: run.conclusion, id: run.id, url: run.html_url, downloadUrl };
    }),

    downloadApk: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
        const expectedPrefix = `https://api.github.com/repos/${repo}/actions/artifacts/`;
        if (!token || !input.url.startsWith(expectedPrefix)) throw new Error("رابط APK غير صالح");
        const response = await fetch(input.url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        if (!response.ok) throw new Error("تعذر تنزيل APK");
        const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
        const apkPath = Object.keys(files).find((path) => path.toLowerCase().endsWith(".apk"));
        if (!apkPath) throw new Error("لم يتم العثور على APK داخل النتيجة");
        return { fileName: "SaidEXE.apk", content: Buffer.from(files[apkPath]).toString("base64") };
      }),

    cancelBuild: publicProcedure
      .input(z.object({ runId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
        if (!token) throw new Error("GitHub token not configured");
        let runId = input.runId;
        if (!runId) {
          const latest = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
          const latestData = await latest.json();
          runId = latestData.workflow_runs?.[0]?.id;
        }
        if (!runId) return { success: false, reason: "no_run" };
        const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        if (response.status !== 202 && response.status !== 409) throw new Error("تعذر إلغاء مهمة البناء");
        return { success: true, runId };
      }),

    downloadArtifact: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
        const expectedPrefix = `https://api.github.com/repos/${repo}/actions/artifacts/`;
        if (!token || !input.url.startsWith(expectedPrefix)) throw new Error("رابط النتيجة غير صالح");
        const response = await fetch(input.url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        if (!response.ok) throw new Error("تعذر تنزيل ملف EXE");
        const archive = new Uint8Array(await response.arrayBuffer());
        const files = unzipSync(archive);
        const exePath = Object.keys(files).find((path) => path.toLowerCase().endsWith(".exe"));
        if (!exePath) throw new Error("لم يتم العثور على ملف EXE داخل Artifact");
        return { fileName: "SaidEXE.exe", content: Buffer.from(files[exePath]).toString("base64") };
      }),

    checkStatus: publicProcedure.query(async () => {
      const token = process.env.GITHUB_ACTIONS_TOKEN;
      const repo = "mohammedsaidelhabach1-png/Said-EXE-Builder8";
      if (!token) throw new Error("GitHub token not configured");
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error("تعذر قراءة حالة GitHub Actions");
      const data = await response.json();
      const run = data.workflow_runs?.[0];
      if (!run) return { status: "no_runs" };

      let downloadUrl = null;
      if (run.status === "completed" && run.conclusion === "success") {
        const artifacts = await fetch(run.artifacts_url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        const artData = await artifacts.json();
        downloadUrl = artData.artifacts?.[0]?.archive_download_url || null;
      }

      return {
        status: run.status,
        conclusion: run.conclusion,
        id: run.id,
        url: run.html_url,
        downloadUrl,
      };
    }),
  }),

  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
