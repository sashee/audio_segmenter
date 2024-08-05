import child_process from "child_process";
import os from "os";
import crypto from  "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {withFileCache} from "with-file-cache";
import util from "node:util";

const __dirname = import.meta.dirname;

export const createTempDir = async () => fs.mkdtemp(await fs.realpath(os.tmpdir()) + path.sep);

export const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");

export const fileExists = async (file) => {
	try {
		await fs.access(file, fs.constants.F_OK);
		return true;
	}catch(e) {
		return false;
	}
};

export const addFileCache = withFileCache(
	{baseKey: async () => {
		const files = [
			"package-lock.json",
			"shell.nix",
		];
		return (await Promise.all(files.map((file) => fs.readFile(file)))).map((contents) => sha(contents)).join(";");
	}},
);

export const withTempDir = async (fn) => {
	const dir = await createTempDir();
	try {
		return await fn(dir);
	}finally {
		await fs.rm(dir, {recursive: true});
	}
};

export const transcript = addFileCache(async (file, modelFile) => {
	console.log("transcribing", file);
	return withTempDir(async (dir) => {
		try {
			await util.promisify(child_process.execFile)("ffmpeg", ["-nostdin", "-threads", "0", "-i", file, "-f", "wav", "-ac", "1", "-acodec", "pcm_s16le", "-ar", "16000", "processed.wav"], {cwd: dir});
			await util.promisify(child_process.execFile)("whisper-cpp", ["-m", modelFile, "-f", "processed.wav", "--output-json-full", "--output-file", "result"], {cwd: dir});
		}catch(e){
			console.log(file);
			throw e;
		}

		return JSON.parse(await fs.readFile(`${dir}/result.json`, "utf8"));
	});
}, {calcCacheKey: (file, modelFile) => ["transcript_1", file, modelFile]});

export const encodeAudio = addFileCache(async (file, msFrom, msTo, sampleRate) => {
	console.log("encodeAudio", file, msFrom, msTo);
	return withTempDir(async (dir) => {
		try {
			await util.promisify(child_process.execFile)("ffmpeg", ["-nostdin", "-i", file, "-f", "wav", "-ac", "1", "-acodec", "pcm_s16le", "-ar", sampleRate, "-ss", `${msFrom}ms`, "-t", `${msTo - msFrom}ms`, "processed.wav"], {cwd: dir});
		}catch(e){
			console.log(file);
			throw e;
		}

		return await fs.readFile(`${dir}/processed.wav`);
	});
}, {calcCacheKey: (file, msFrom, msTo, sampleRate) => ["encodeAudio_1", file, msFrom, msTo, sampleRate]});

export const detectSilences = addFileCache(async (file, noise, duration) => {
	const silenceRegex = /silence_end: (?<silenceEnd>[\d.]*).*silence_duration: (?<silenceDuration>[\d.]*)/;
	const {stderr} = await util.promisify(child_process.execFile)("ffmpeg", ["-nostdin", "-i", file, "-af", `silencedetect=n=${noise}:d=${duration}`, "-f", "null", "-"], {});
	const silences = stderr
		.split("\n")
		.filter((line) => line.match(silenceRegex) !== null)
		.map((line) => line.match(silenceRegex).groups)
		.map(({silenceEnd, silenceDuration}) => ({silenceEnd: Math.round(Number(silenceEnd) * 1000), silenceDuration: Math.round(Number(silenceDuration) * 1000)}))
		.map(({silenceEnd, silenceDuration}) => ({silenceStart: silenceEnd - silenceDuration, silenceEnd}));
	return silences;
}, {calcCacheKey: (file, noise, duration) => ["detectsilences_1", file, noise, duration]});

export const getLengthInMs = addFileCache(async (file) => {
	const {stdout} = await util.promisify(child_process.execFile)("ffprobe", ["-i", file, "-show_entries", "format=duration", "-v", "quiet", "-output_format", "json"], {});
	return Math.round(Number(JSON.parse(stdout).format.duration) * 1000);
}, {calcCacheKey: (file) => ["getLength_1", file]});
