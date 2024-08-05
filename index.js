import {transcript, encodeAudio, detectSilences, getLengthInMs} from "./utils.js";
import path from "node:path";
import fs from "node:fs/promises";
import {closest} from "fastest-levenshtein";

//  whisper-cpp-download-ggml-model base.en

const __dirname = import.meta.dirname;

const processLesson = async (lessonDir) => {
	const files = await fs.readdir(lessonDir);
	const audioFiles = files.filter((name) => [".flac", ".wav", ".mp3"].includes(path.extname(name))).toSorted((a, b) => a.localeCompare(b, "en", {numeric: true}));
	const transcriptFiles = files.filter((name) => [".txt"].includes(path.extname(name))).toSorted((a, b) => a.localeCompare(b, "en", {numeric: true}));
	const sentences = (await Promise.all(transcriptFiles.map((file) => fs.readFile(path.join(lessonDir, file), "utf8"))))
		.join("\n")
		.split("\n")
		.filter((line) => !line.startsWith("//"))
		.filter((line) => line.trim() !== "")
		.join(" ")
		.split(/[.?!:]/)
		.map((line) => line.trim())
		.filter((line) => line !== "")
	;
	// console.log(sentences)
	const loadTranscription = async (file) => {
		const res = await transcript(file, path.join(__dirname, "ggml-base.en.bin"));
		const processTranscript = (transcription) => {
			return transcription
				.map(({offsets, text}) => ({offsets, text: text.trim()}))
				.reduce(({finishedSentences, current}, element) => {
					const finishing = element.text.match(/[.?!]$/) !== null
					if (current === undefined) {
						if (finishing) {
							return {finishedSentences: [...finishedSentences, {...element, text: element.text}], current: undefined};
						}else {
							return {finishedSentences, current: element};
						}
					}else {
						if (finishing) {
							return {finishedSentences: [...finishedSentences, {offsets: {from: current.offsets.from, to: element.offsets.to}, text: [current.text, element.text].join(" ")}], current: undefined};
						}else {
							return {finishedSentences, current: {offsets: {from: current.offsets.from, to: element.offsets.to}, text: [current.text, element.text].join(" ")}};
						}
					}
				}, {finishedSentences: [], current: undefined}).finishedSentences;
		};
		return processTranscript(res.transcription).map((item) => ({...item, file}));
	}
	const transcription = (await audioFiles.reduce(async (memo, file) => {
		const result = await memo;
		const res = await loadTranscription(path.join(lessonDir, file))
		return [...result, res];
		}, Promise.resolve([]))).flat(1);

	const cleanSentence = (sentence) => {
		return sentence
			.split(",").join("")
			.split("(").join("")
			.split(")").join("")
			.split("/").join(" ")
			.split(":").join("")
			.split("1").join("one")
			.split("2").join("two")
			.split("3").join("three")
			.split("10").join("ten")
			.split("key word").join("keyword")
			.split("'ll").join(" will")
			.split("it's").join("it is")
			.split("we're").join("we are")
			.split("we've").join("we have")
			.split("-").join(" ")
			.split("can not").join("cannot")
			.split("callback").join("call back")
			.replace(/[.!?]$/, "")
			.toLowerCase();
	}
	const matching = transcription.filter(({text}) => {
		return sentences
			.map(cleanSentence)
			.includes(
				cleanSentence(text)
			);
	})
	const totalSeconds = matching.reduce((memo, {offsets}) => memo + (offsets.to - offsets.from), 0) / 1000;
	const totalUtterances = matching.length;
	//console.log(matching.reduce((memo, {offsets}) => memo + (offsets.to - offsets.from), 0) / 1000);
	//console.log(matching.map(({text}) => ({text: cleanSentence(text), clos: cleanSentence(closest(text, sentences))})));
	//console.log(matching.length, "vs", transcription.length)
	return {totalSeconds, totalUtterances, sentences: matching};
}

const lessonDirs = [
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-0-structure"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-1"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-2"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-3"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-4"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-5"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-6"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-7"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-8"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-9"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-10"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-11"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-12"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-13"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-14"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "js-async-course", "lesson-15"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "intro"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-1"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-2"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-3"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-4"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-5"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-6"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-7"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-8"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-9"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-10"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-11"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-12"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-13"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-14"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-15"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-16"),
	path.join("/", "home", "sashee", "workspace", "udemy_cloudfront_course", "src", "aws-auth-course", "lesson-17"),
];
const results = await lessonDirs.reduce(async (memo, lessonDir) => {
	const results = await memo;
	const result = await processLesson(lessonDir);
	return [...results, result];
}, Promise.resolve([]));
const totalSeconds = results.reduce((memo, {totalSeconds}) => memo + totalSeconds, 0);
const totalUtterances = results.reduce((memo, {totalUtterances}) => memo + totalUtterances, 0);
console.log({totalSeconds, totalUtterances});
//console.log(JSON.stringify(results, undefined, 4));

const flattenedSentences = results.flatMap(({sentences}) => sentences);

const fixOffsetToSilence = async (file, offsets) => {
	const silences = await detectSilences(file, "-30dB", "0.1");
	const silencesWithBothEnds = await (async () => {
		const length = await getLengthInMs(file);
		return [
			...(silences.some(({silenceStart}) => silenceStart <= 0) ? [] : [{silenceStart: 0, silenceEnd: 0}]),
			...silences,
			...(silences.some(({silenceEnd}) => silenceEnd >= length) ? [] : [{silenceEnd: length, silenceEnd: length}]),
		];
	})();
	const findPoint = (timestamp, alignToStart) => {
		const findLastSilence = (timestamp) => 
			silencesWithBothEnds
				.filter(({silenceStart}) => silenceStart <= timestamp)
				.toSorted((a, b) => a.silenceStart - b.silenceStart)
				.toReversed()
				[0];
		const findFirstSilence = (timestamp) => 
			silencesWithBothEnds
				.filter(({silenceEnd}) => silenceEnd >= timestamp)
				.toSorted((a, b) => a.silenceEnd - b.silenceEnd)
				[0];
		const lastSilence = findLastSilence(timestamp);
		const firstSilence = findFirstSilence(timestamp);
		const moveToSilence = (timestamp - lastSilence.silenceEnd > 200 && firstSilence !== undefined) ?
			(Math.abs(timestamp - lastSilence.silenceEnd) > Math.abs(timestamp - firstSilence.silenceStart) ? firstSilence : lastSilence) :
			lastSilence;
		const midpoint = Math.round((moveToSilence.silenceEnd + moveToSilence.silenceStart) / 2);
		return alignToStart ? Math.max(moveToSilence.silenceEnd - 500, midpoint) : Math.min(moveToSilence.silenceStart + 500, midpoint);
	}
	const pointForOffsetFrom = findPoint(offsets.from, true);
	const pointForOffsetTo = findPoint(offsets.to, false);
	return {from: pointForOffsetFrom, to: pointForOffsetTo};
};

const fixedOffsets = await Promise.all(flattenedSentences.map(async ({offsets, file, text}) => {
	const fixedOffsets = await fixOffsetToSilence(file, offsets, text);
	return {
		file,
		text,
		offsets: fixedOffsets,
	};
}));

const encodedTexts = await fixedOffsets.reduce(async (memo, sentence) => {
	const results = await memo;
	const audio = await encodeAudio(sentence.file, sentence.offsets.from, sentence.offsets.to, 22050);
	return [...results, {audio, text: sentence.text}];
}, Promise.resolve([]));

// console.log(encodedTexts);

const outputDir = path.join(__dirname, "dataset_dir");
await fs.rm(outputDir, {recursive: true, force: true});
await fs.mkdir(outputDir);
const wavs = path.join(outputDir, "wavs");
await fs.mkdir(wavs);
const writtenWavs = await Promise.all(encodedTexts.map(async ({audio, text}, i) => {
	const fileName = `${i}.wav`;
	await fs.writeFile(path.join(wavs, fileName), audio);
	return {text, fileName};
}));

await fs.writeFile(path.join(outputDir, "metadata.csv"), writtenWavs.map(({text, fileName}) => `wavs/${fileName}|${text}`).join("\n"));
