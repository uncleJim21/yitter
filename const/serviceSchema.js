
const OFFERING_KIND = 31_402;

const YTDL_SCHEMA = {
    "type": "object",
    "properties": {
        "videoId": {
            "type": "string"
        },
    },
    "required": ["videoId"]
}

const YTDL_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "videoUrl": {
            "type": "string"
        },
    },
    "required": ["videoUrl"]
}

module.exports = { OFFERING_KIND, YTDL_RESULT_SCHEMA, YTDL_SCHEMA };