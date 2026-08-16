import { NextRequest, NextResponse } from "next/server";
import { JobPosting, JobRoleCategory, SeniorityLevel, WorkLocation } from "@/core/dtos/job.dto";
import { jobRepository } from "@/core/repositories/job-repository";
import { profileRepository } from "@/core/repositories/profile-repository";
import { scoringService } from "@/core/services/scoring-service";
import { getCompanyLogoUrl } from "@/core/utils/logo-resolver";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawJobs = Array.isArray(body.jobs) ? body.jobs : body.job ? [body.job] : [body];

    if (!rawJobs || rawJobs.length === 0 || !rawJobs[0].title) {
      return NextResponse.json(
        { success: false, message: "Dữ liệu việc làm không hợp lệ hoặc bị rỗng" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const currentProfile = profileRepository.getProfile();
    const processedJobs: any[] = [];

    for (const raw of rawJobs) {
      const title = (raw.title || "Vị trí Phân tích Nghiệp vụ/Dữ liệu").trim();
      const company = (raw.company || "Doanh nghiệp tuyển dụng").trim();
      const rawDesc = raw.jobDescription || raw.description || "";
      const fullText = `${title} ${company} ${rawDesc}`;

      // Bóc tách địa điểm
      const locText = (raw.locationDetails || raw.location || "").toLowerCase();
      const isDongNai = locText.includes("đồng nai") || locText.includes("dong nai") || locText.includes("biên hòa") || locText.includes("bien hoa");
      const location: WorkLocation = isDongNai ? "DONG_NAI" : "HO_CHI_MINH";

      // Bóc tách vai trò
      const titleLower = title.toLowerCase();
      const isDA = titleLower.includes("data") || titleLower.includes("dữ liệu") || titleLower.includes("bi ");
      const isBA = titleLower.includes("business") || titleLower.includes("nghiệp vụ") || titleLower.includes("ba ");
      const roleCategory: JobRoleCategory = isDA && isBA ? "HYBRID_BA_DA" : isDA ? "DATA_ANALYST" : "BUSINESS_ANALYST";

      // Bóc tách cấp bậc
      let seniority: SeniorityLevel = "SENIOR";
      if (titleLower.includes("lead") || titleLower.includes("manager") || titleLower.includes("trưởng nhóm") || titleLower.includes("head")) {
        seniority = "LEAD_MANAGER";
      } else if (titleLower.includes("junior") || titleLower.includes("fresher")) {
        seniority = "JUNIOR";
      } else if (titleLower.includes("middle") || titleLower.includes("chuyên viên")) {
        seniority = "MIDDLE";
      }

      // Trích xuất kỹ năng
      const extractedSkills = raw.extractedSkills && raw.extractedSkills.length > 0
        ? raw.extractedSkills
        : scoringService.extractSkillsFromText(fullText);

      const logoUrl = getCompanyLogoUrl(company, raw.companyLogo || raw.logoUrl);

      // Phân tách tóm tắt yêu cầu và trách nhiệm
      const lines = rawDesc
        .split("\n")
        .map((l: string) => l.trim().replace(/^[-*•]\s*/, ""))
        .filter((l: string) => l.length > 15);

      const responsibilitiesSummary = raw.responsibilitiesSummary || (lines.length >= 2 ? lines.slice(0, 4) : ["Thực hiện nhiệm vụ phân tích theo yêu cầu dự án"]);
      const requirementsSummary = raw.requirementsSummary || (lines.length >= 4 ? lines.slice(4, 8) : ["Có kinh nghiệm thực tế phù hợp với mô tả công việc"]);

      const jobData: JobPosting = {
        id: raw.id || `linkedin-ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        company,
        companyLogo: logoUrl,
        location,
        locationDetails: raw.locationDetails || (location === "DONG_NAI" ? "Đồng Nai" : "TP. Hồ Chí Minh"),
        roleCategory,
        seniority,
        salaryRange: raw.salaryRange || {
          isNegotiable: true,
          currency: "VND",
          display: raw.salaryText || "Thỏa thuận theo năng lực",
        },
        workMode: raw.workMode || "HYBRID",
        jobDescription: rawDesc || `Chi tiết tuyển dụng vị trí ${title} tại ${company}.`,
        requirementsSummary,
        responsibilitiesSummary,
        extractedSkills,
        linkedinUrl: raw.linkedinUrl || raw.url || "https://www.linkedin.com/jobs",
        postedDate: raw.postedDate || new Date().toISOString().split("T")[0],
        experienceYearsRequired: raw.experienceYearsRequired || (seniority === "LEAD_MANAGER" ? 5 : seniority === "SENIOR" ? 4 : 2),
      };

      const savedJob = jobRepository.addJob(jobData);
      const scoreResult = scoringService.calculateMatchScore(currentProfile, savedJob);

      processedJobs.push({
        ...savedJob,
        scoreResult,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Đã nhập thành công ${processedJobs.length} việc làm từ LinkedIn Extension`,
        data: processedJobs,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Lỗi trong quá trình nhập dữ liệu việc làm",
        error: String(error),
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
