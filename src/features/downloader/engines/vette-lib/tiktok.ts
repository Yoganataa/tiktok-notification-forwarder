import axios from "axios";
import { load } from "cheerio";

export const getVideo = async (url: string) => {
  const BASE_URL = "https://tikdown.org/";

  try {
    const response = await axios.post(
      "https://tikdown.org/getAjax?",
      new URLSearchParams({
        url: url,
        _token: "",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
          Referer: "https://tikdown.org/",
        },
      }
    );

    const html = response.data.html;
    const $ = load(html);

    const downloadLink = $(".dl-action a").attr("href");

    if (!downloadLink) {
      throw new Error("Failed to retrieve download link.");
    }

    return {
      status: "success",
      result: {
        type: "video",
        url: downloadLink,
      },
    };
  } catch (error) {
    console.error("Error fetching video:", error);
    return {
      status: "error",
      message: "Failed to download video.",
    };
  }
};
