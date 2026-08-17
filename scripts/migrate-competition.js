const fs = require("fs");
const path = require("path");

const jobsFilePath = path.join(__dirname, "..", "data", "jobs.json");

function parseCompetitionAndMetadata(job) {
  const allTexts = [];
  if (job.locationDetails) allTexts.push(job.locationDetails);
  if (job.rawBadges && job.rawBadges.length > 0) allTexts.push(...job.rawBadges);
  if (job.rawContent) allTexts.push(job.rawContent.substring(0, 1000));

  const combinedText = allTexts.join(" · \n ");

  // 1. Cờ đặc biệt
  const isPromoted = /promoted\s+by\s+hirer|promoted|được\s+nhà\s+tuyển\s+dụng\s+tài\s+trợ/i.test(combinedText);
  const responsesManagedOffLinkedIn = /responses\s+managed\s+off\s+linkedin|quản\s+lý\s+hồ\s+sơ\s+ngoài\s+linkedin/i.test(combinedText);
  const isActivelyReviewing = /actively\s+reviewing\s+applicants|đang\s+tích\s+cực\s+xem\s+xét/i.test(combinedText);

  // 2. Bóc tách số lượng ứng viên
  let applicantCount = undefined;
  let applicantCountText = undefined;
  let competitionLevel = "UNKNOWN";

  // Mẫu 1: "Be among the first 25 applicants"
  const firstMatch = combinedText.match(/be\s+among\s+the\s+first\s+(\d+)\s+applicants|trong\s+số\s+(\d+)\s+ứng\s+viên\s+đầu\s+tiên/i);
  if (firstMatch) {
    const num = parseInt(firstMatch[1] || firstMatch[2] || "25", 10);
    applicantCount = num;
    applicantCountText = `< ${num} ứng viên (Đầu tiên)`;
    competitionLevel = "LOW";
  }

  // Mẫu 2: "Over 100 people clicked apply" hoặc "11 people clicked apply"
  if (!applicantCountText) {
    const clickedMatch = combinedText.match(/(over|trên)?\s*(\d+)\s*(?:\+|plus)?\s*(?:people\s+clicked\s+apply|người\s+(?:đã\s+)?nhấp\s+ứng\s+tuyển|người\s+nhấp\s+nộp\s+đơn)/i);
    if (clickedMatch) {
      const isOver = Boolean(clickedMatch[1]);
      const num = parseInt(clickedMatch[2], 10);
      applicantCount = num;
      applicantCountText = isOver ? `>${num} lượt nộp đơn` : `${num} lượt nộp đơn`;
      if (isOver || num > 100) {
        competitionLevel = "HIGH";
      } else if (num > 25) {
        competitionLevel = "MEDIUM";
      } else {
        competitionLevel = "LOW";
      }
    }
  }

  // Mẫu 3: "6 applicants", "35 applicants", "85 applicants", "Over 200 applicants"
  if (!applicantCountText) {
    const applicantsMatch = combinedText.match(/(over|trên)?\s*(\d+)\s*(?:\+|plus)?\s*(?:applicants|ứng\s+viên|người\s+nộp\s+đơn|người\s+ứng\s+tuyển)/i);
    if (applicantsMatch) {
      const isOver = Boolean(applicantsMatch[1]);
      const num = parseInt(applicantsMatch[2], 10);
      applicantCount = num;
      applicantCountText = isOver ? `>${num} ứng viên` : `${num} ứng viên`;
      if (isOver || num > 100) {
        competitionLevel = "HIGH";
      } else if (num > 25) {
        competitionLevel = "MEDIUM";
      } else {
        competitionLevel = "LOW";
      }
    }
  }

  // 3. Chuẩn hóa ngày đăng
  let parsedPostedDate = job.postedDate || "";
  if (!parsedPostedDate || parsedPostedDate.trim() === "") {
    const dateMatch = combinedText.match(/(?:reposted\s+)?(\d+\s*(?:hours?|days?|weeks?|months?|phút|giờ|ngày|tuần|tháng)\s*ago|\d+\s*(?:phút|giờ|ngày|tuần|tháng)\s*trước)/i);
    if (dateMatch) {
      parsedPostedDate = dateMatch[0].trim();
    } else if (/yesterday|hôm qua/i.test(combinedText)) {
      parsedPostedDate = "Hôm qua";
    } else if (/just now|vừa xong|vừa đăng/i.test(combinedText)) {
      parsedPostedDate = "Vừa đăng";
    }
  }

  // 4. Làm sạch locationDetails
  let cleanedLocationDetails = job.locationDetails || "";
  if (cleanedLocationDetails.includes("·")) {
    cleanedLocationDetails = cleanedLocationDetails.split("·")[0].trim();
  }
  if (cleanedLocationDetails.includes("\n")) {
    cleanedLocationDetails = cleanedLocationDetails.split("\n")[0].trim();
  }
  cleanedLocationDetails = cleanedLocationDetails
    .replace(/(?:reposted\s+)?\d+\s*(?:hours?|days?|weeks?|months?)\s*ago/gi, "")
    .replace(/\d+\s*applicants/gi, "")
    .replace(/over\s+\d+\s*people\s*clicked\s*apply/gi, "")
    .replace(/\d+\s*people\s*clicked\s*apply/gi, "")
    .replace(/promoted\s*by\s*hirer/gi, "")
    .replace(/responses\s*managed\s*off\s*linkedin/gi, "")
    .replace(/actively\s*reviewing\s*applicants/gi, "")
    .replace(/company\s*review\s*time\s*is\s*typically[^\n.]*/gi, "")
    .trim();

  if (!cleanedLocationDetails || cleanedLocationDetails.length < 3) {
    if (combinedText.toLowerCase().includes("ho chi minh") || combinedText.toLowerCase().includes("hồ chí minh") || combinedText.toLowerCase().includes("hcm")) {
      cleanedLocationDetails = "Ho Chi Minh City, Vietnam";
    } else if (combinedText.toLowerCase().includes("dong nai") || combinedText.toLowerCase().includes("đồng nai")) {
      cleanedLocationDetails = "Đồng Nai, Vietnam";
    } else {
      cleanedLocationDetails = "Việt Nam";
    }
  }

  return {
    applicantCountText,
    applicantCount,
    competitionLevel,
    isPromoted,
    responsesManagedOffLinkedIn,
    isActivelyReviewing,
    cleanedLocationDetails,
    parsedPostedDate,
  };
}

try {
  const raw = fs.readFileSync(jobsFilePath, "utf-8");
  const jobs = JSON.parse(raw);
  console.log(`Đang xử lý di trú ${jobs.length} việc làm...`);

  let countUpdated = 0;
  let stats = { LOW: 0, MEDIUM: 0, HIGH: 0, UNKNOWN: 0 };

  const updatedJobs = jobs.map((job) => {
    const parsed = parseCompetitionAndMetadata(job);
    stats[parsed.competitionLevel] = (stats[parsed.competitionLevel] || 0) + 1;
    countUpdated++;

    return {
      ...job,
      locationDetails: parsed.cleanedLocationDetails || job.locationDetails,
      postedDate: parsed.parsedPostedDate || job.postedDate || "",
      crawledAt: job.crawledAt || job.timestamp || "2026-08-16T14:05:00.000Z",
      applicantCountText: parsed.applicantCountText,
      applicantCount: parsed.applicantCount,
      competitionLevel: parsed.competitionLevel,
      isPromoted: parsed.isPromoted,
      responsesManagedOffLinkedIn: parsed.responsesManagedOffLinkedIn,
      isActivelyReviewing: parsed.isActivelyReviewing,
    };
  });

  fs.writeFileSync(jobsFilePath, JSON.stringify(updatedJobs, null, 2), "utf-8");
  console.log(`Hoàn tất di trú ${countUpdated} việc làm.`);
  console.log("Thống kê mức cạnh tranh:", stats);
} catch (err) {
  console.error("Lỗi di trú:", err);
  process.exit(1);
}
