import { NextRequest, NextResponse } from "next/server";
import { cvMatcherService } from "@/core/services/cv-matcher-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvText } = body;

    if (!cvText || typeof cvText !== "string" || cvText.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập nội dung CV của bạn." },
        { status: 400 }
      );
    }

    const result = cvMatcherService.analyzeAndMatchCv(cvText);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi trong quá trình phân tích và so khớp CV", error: String(error) },
      { status: 500 }
    );
  }
}
