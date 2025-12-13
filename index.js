const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const { BanchoClient } = require("bancho.js");
const { Client } = require("nodesu");

process.on('unhandledRejection', error => console.log(error));
process.on('uncaughtException', error => console.log(error));

const bancho = new BanchoClient(require("./config.json").bancho);
bancho.connect().then(() => {
    console.log("[INFO] Connected to Bancho!");
});

const client = new TikTokLiveConnection(require("./config.json").username);

client.connect().then(state => {
    console.info(`Connected to roomId: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});

client.on(WebcastEvent.CHAT, async (data) => {
    // Only allow messages that match these regex patterns exactly
    const regex = {
        beatmap_official: /^https?:\/\/osu.ppy.sh\/beatmapsets\/[0-9]+\#(osu|taiko|fruits|mania)\/([0-9]+)$/,
        beatmap_old: /^https?:\/\/(osu|old).ppy.sh\/b\/([0-9]+)$/,
        beatmap_alternate: /^https?:\/\/osu.ppy.sh\/beatmaps\/([0-9]+)$/,
        beatmap_old_alternate: /^https?:\/\/(osu|old).ppy.sh\/p\/beatmap\?b=([0-9]+)$/,
        beatmapset_official: /^https?:\/\/osu.ppy.sh\/beatmapsets\/([0-9]+)$/,
        beatmapset_old: /^https?:\/\/(osu|old).ppy.sh\/s\/([0-9]+)$/,
        beatmapset_old_alternate: /^https?:\/\/(osu|old).ppy.sh\/p\/beatmap\?s=([0-9]+)$/,
    };
    const comment = data.comment.trim();

    let matchedKey = null;
    let matchResult = null;

    for (const key in regex) {
        matchResult = comment.match(regex[key]);
        if (matchResult) {
            matchedKey = key;
            break;
        }
    }

    if (!matchedKey) return;
    // Extract beatmap ID - it's in group 2 for beatmap patterns, group 1 for beatmapset patterns
    const beatmapId = matchedKey.includes('beatmapset') ? matchResult[1] : matchResult[2];
    const { beatmaps } = new Client(require("./config.json").bancho.apiKey);
    const beatmap = await beatmaps.getByBeatmapId(beatmapId);

    if (beatmap.length == 0) {
        console.log(`[DEBUG] No beatmap found for ID: ${beatmapId}`);
        return;
    }

    await sendMsg(require("./config.json").bancho.username, `${data.user.uniqueId} -> [${Approved(beatmap)}] | [${Mode(beatmap)}] [https://osu.ppy.sh/b/${beatmap[0].beatmap_id} ${beatmap[0].title}] (${parseInt(beatmap[0].difficultyrating).toFixed(2)}*, ${beatmap[0].bpm} BPM, ${convertSeconds(beatmap[0].total_length)}) - [https://beatconnect.io/b/${beatmap[0].beatmapset_id} [1]] [https://dl.sayobot.cn/beatmaps/download/novideo/${beatmap[0].beatmapset_id} [2]] [https://api.nerinyan.moe/d/${beatmap[0].beatmapset_id}?nv=1 [3]]`)
    console.log(`[DEBUG] Message sent successfully, from user: ${data.user.uniqueId} beatmap: ${beatmap[0].title} - https://osu.ppy.sh/b/${beatmap[0].beatmap_id}`);
});

function convertSeconds(seconds) {
	var hours = Math.floor(seconds / 3600);
		seconds %= 3600;
	var minutes = Math.floor(seconds / 60);
		seconds = Math.floor(seconds % 60);
  
  	return (hours ? hours + ":" + (minutes < 10 ? "0" : "") : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function Mode(beatmap) {
	let status = ""
    const mode = beatmap[0].mode;

	if (mode == 0) {
		status = "Standard";
	} else if (mode == 1) {
		status = "Taiko";
	} else if (mode == 2) {
		status = "Catch";
	} else if (mode == 3) {
		status = "Mania";
	}

	return status;
}

function Approved(beatmap) {
	let status = "";
    const approved = beatmap[0].approved;

	if(approved == -2) {
		status = "Graveyard"
	} else if (approved == -1) {
		status = "WIP"
	} else if(approved == 0) {
		status = "Pending"
	} else if (approved == 1) {
		status = "Ranking"
	} else if (approved == 2) {
		status = "Approved"
	} else if (approved == 3) {
		status = "Qualified"
	} else if (approved == 4) {
		status = "Loved"
	}

	return status;
}

async function sendMsg(user, message) {
	const player = bancho.getUser(user);
	player.sendMessage(message);
}