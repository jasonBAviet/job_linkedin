import { NextRequest, NextResponse } from "next/server";
import { profileRepository } from "@/core/repositories/profile-repository";
import { scoringService } from "@/core/services/scoring-service";

export async function GET() {
  try {
    const profile = profileRepository.getProfile();
    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi lấy thông tin hồ sơ ứng viên", error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = profileRepository.updateProfile(body);

    return NextResponse.json({
      success: true,
      message: "Cập nhật hồ sơ ứng viên thành công.",
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi cập nhật hồ sơ ứng viên", error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // API hỗ trợ parse CV thô và tự động thêm kỹ năng vào Profile
    const body = await request.json();
    const rawResume = body.rawResumeText || "";

    if (!rawResume.trim()) {
      return NextResponse.json({ success: false, message: "Nội dung CV không được để trống" }, { status: 400 });
    }

    const extractedSkills = scoringService.extractSkillsFromText(rawResume);
    const currentProfile = profileRepository.getProfile();

    const existingSkillNames = new Set(currentProfile.skills.map((s) => s.name.toLowerCase()));
    const newSkillsToAdd = extractedSkills
      .filter((s) => !existingSkillNames.has(s.name.toLowerCase()))
      .map((s) => ({
        name: s.name,
        category: s.category,
        proficiencyLevel: 4 as const,
        yearsOfExperience: 2,
      }));

    const updatedProfile = profileRepository.updateProfile({
      rawResumeText: rawResume,
      skills: [...currentProfile.skills, ...newSkillsToAdd],
    });

    return NextResponse.json({
      success: true,
      message: `Đã trích xuất thành công ${newSkillsToAdd.length} kỹ năng mới từ CV.`,
      data: updatedProfile,
      extractedCount: newSkillsToAdd.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi phân tích CV ứng viên", error: String(error) },
      { status: 500 }
    );
  }
}
