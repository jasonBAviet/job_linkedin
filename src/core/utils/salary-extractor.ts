export interface ParsedSalaryResult {
  min?: number;
  max?: number;
  currency: "VND" | "USD";
  display: string;
  isNegotiable?: boolean;
}

/**
 * Tiện ích bóc tách mức lương tự động từ tiêu đề, mô tả và badges (Salary Extractor)
 */
export class SalaryExtractor {
  public static extract(
    salaryInput?: string,
    rawContent?: string,
    badges: string[] = [],
    title: string = ""
  ): ParsedSalaryResult | undefined {
    // 1. Kiểm tra nếu có dữ liệu salary từ badge hoặc input trực tiếp
    const candidateText =
      salaryInput ||
      badges.find((b) => b.includes("₫") || b.includes("$") || b.includes("Triệu") || b.includes("tháng")) ||
      "";

    if (candidateText && candidateText.length > 2) {
      const isUSD = candidateText.includes("$") || candidateText.toUpperCase().includes("USD");
      const vndRange = candidateText.match(/(\d{1,3})\s*(?:tr|triệu|m|million)?\s*[-–~to]+\s*(\d{1,3})\s*(?:tr|triệu|m|million|vnd|đ)/i);
      if (vndRange) {
        const minM = parseInt(vndRange[1], 10);
        const maxM = parseInt(vndRange[2], 10);
        if (minM > 0 && maxM > minM) {
          return { min: minM * 1000000, max: maxM * 1000000, currency: "VND", display: candidateText, isNegotiable: true };
        }
      }
      return { currency: isUSD ? "USD" : "VND", display: candidateText, isNegotiable: true };
    }

    const fullText = `${title}\n${badges.join(" ")}\n${(rawContent || "").substring(0, 3000)}`;

    // 2. Dải lương USD: $1,500 - $2,500 hoặc 1500 - 2500 USD
    const rangeUsd =
      fullText.match(/(?:\$|usd\s*)(\d{1,2}(?:,\d{3})?|\d{3,5})\s*[-–~to]+\s*(?:\$|usd\s*)?(\d{1,2}(?:,\d{3})?|\d{3,5})\s*(?:usd|\$)?/i) ||
      fullText.match(/(\d{1,2}(?:,\d{3})?|\d{3,5})\s*(?:\$|usd)?\s*[-–~to]+\s*(\d{1,2}(?:,\d{3})?|\d{3,5})\s*(?:usd|\$)/i);
    if (rangeUsd) {
      const min = parseInt(rangeUsd[1].replace(/,/g, ""), 10);
      const max = parseInt(rangeUsd[2].replace(/,/g, ""), 10);
      if (min >= 300 && max <= 30000 && min < max) {
        return {
          min,
          max,
          currency: "USD",
          display: `$${min.toLocaleString()} - $${max.toLocaleString()} USD`,
          isNegotiable: true,
        };
      }
    }

    // 3. Up to USD: Up to $2000 hoặc Upto 2500 USD
    const upToUsd =
      fullText.match(/(?:up\s*to|upto|tới|lên\s*tới|tối\s*đa|max)\s*(?:\$|usd\s*)(\d{1,2}(?:,\d{3})?|\d{3,5})\s*(?:usd|\$)?/i) ||
      fullText.match(/(?:up\s*to|upto|tới|lên\s*tới|tối\s*đa|max)\s*(\d{1,2}(?:,\d{3})?|\d{3,5})\s*(?:usd|\$)/i);
    if (upToUsd) {
      const max = parseInt(upToUsd[1].replace(/,/g, ""), 10);
      if (max >= 300 && max <= 30000) {
        return {
          min: Math.round(max * 0.7),
          max,
          currency: "USD",
          display: `Up to $${max.toLocaleString()} USD`,
          isNegotiable: true,
        };
      }
    }

    // 4. Lương theo giờ USD: $60 - $120/hour
    const hourlyUsd = fullText.match(/(?:\$|usd\s*)(\d{1,3})\s*[-–~to]+\s*(?:\$|usd\s*)?(\d{1,3})\s*(?:\/|\s*per\s*)hour/i);
    if (hourlyUsd) {
      const minH = parseInt(hourlyUsd[1], 10);
      const maxH = parseInt(hourlyUsd[2], 10);
      return {
        min: minH * 160,
        max: maxH * 160,
        currency: "USD",
        display: `$${minH} - $${maxH}/hour`,
        isNegotiable: true,
      };
    }

    // 5. Dải lương VND dạng triệu / M / Tr: 20 - 35 triệu, 20-35tr, 20M - 35M
    const rangeVndM =
      fullText.match(/(\d{1,3})\s*(?:m|tr|triệu)?\s*[-–~to]+\s*(\d{1,3})\s*(?:m|tr|triệu|million)\b/i) ||
      fullText.match(/(?:lương|salary|thu\s*nhập|mức\s*lương|income)?\s*[:：\-]?\s*(\d{1,3})\s*[-–~to]+\s*(\d{1,3})\s*(?:m|tr|triệu|million)\b/i);
    if (rangeVndM) {
      const minM = parseInt(rangeVndM[1], 10);
      const maxM = parseInt(rangeVndM[2], 10);
      if (minM >= 5 && maxM <= 250 && minM < maxM) {
        return {
          min: minM * 1000000,
          max: maxM * 1000000,
          currency: "VND",
          display: `${minM} - ${maxM} Triệu VNĐ`,
          isNegotiable: true,
        };
      }
    }

    // 6. Dải lương VND số đầy đủ: 20.000.000 - 35.000.000 VNĐ
    const rangeVndExact = fullText.match(/(\d{1,3}(?:[.,]\d{3}){2})\s*(?:vnd|đ|d)?\s*[-–~to]+\s*(\d{1,3}(?:[.,]\d{3}){2})\s*(?:vnd|đ|d)?/i);
    if (rangeVndExact) {
      const min = parseInt(rangeVndExact[1].replace(/[.,]/g, ""), 10);
      const max = parseInt(rangeVndExact[2].replace(/[.,]/g, ""), 10);
      if (min >= 5000000 && max <= 250000000 && min < max) {
        const minM = Math.round(min / 1000000);
        const maxM = Math.round(max / 1000000);
        return { min, max, currency: "VND", display: `${minM} - ${maxM} Triệu VNĐ`, isNegotiable: true };
      }
    }

    // 7. Up to VND: Up to 30M, Upto 45 triệu, Lên tới 35tr, Tối đa 50M, UP TO 30M GROSS
    const upToVndM = fullText.match(/(?:up\s*to|upto|tới|lên\s*tới|tối\s*đa|max)\s*(\d{1,3})\s*(?:m|tr|triệu|million)\b/i);
    if (upToVndM) {
      const maxM = parseInt(upToVndM[1], 10);
      if (maxM >= 5 && maxM <= 250) {
        const max = maxM * 1000000;
        const min = Math.round(max * 0.7);
        return { min, max, currency: "VND", display: `Up to ${maxM} Triệu VNĐ`, isNegotiable: true };
      }
    }

    const upToVndExact = fullText.match(/(?:up\s*to|upto|tới|lên\s*tới|tối\s*đa|max)\s*(\d{1,3}(?:[.,]\d{3}){2})\s*(?:vnd|đ|d)?/i);
    if (upToVndExact) {
      const max = parseInt(upToVndExact[1].replace(/[.,]/g, ""), 10);
      if (max >= 5000000 && max <= 250000000) {
        const maxM = Math.round(max / 1000000);
        const min = Math.round(max * 0.7);
        return { min, max, currency: "VND", display: `Up to ${maxM} Triệu VNĐ`, isNegotiable: true };
      }
    }

    return undefined;
  }
}
