import { JobPosting, WorkLocation } from "../dtos/job.dto";
import { jobMappingService } from "./job-mapping-service";
import { DEFAULT_SYSTEM_CONFIG, SystemConfig } from "../constants/app-config";

/**
 * Bóc tách JD do người dùng cung cấp thủ công.
 *
 * Việc thu thập việc làm từ LinkedIn được thực hiện HOÀN TOÀN bằng WebExtension
 * chạy trên trình duyệt đã đăng nhập (xem thư mục `extension/`). Đường cào phía
 * máy chủ qua LinkedIn Guest API đã bị gỡ bỏ: thẻ kết quả của API đó không hề
 * chứa mô tả công việc, nên mọi bản ghi đều bị JobMappingService loại vì thiếu JD
 * — nghĩa là đường đó không bao giờ thêm được việc làm nào.
 */
export class ScraperService {
  private config: SystemConfig;

  constructor(customConfig?: Partial<SystemConfig>) {
    this.config = { ...DEFAULT_SYSTEM_CONFIG, ...customConfig };
  }

  /**
   * Tạm dừng bất đồng bộ ngẫu nhiên mô phỏng hành vi tự nhiên (Jitter)
   */
  public async sleepRandom(minMs?: number, maxMs?: number): Promise<void> {
    const min = minMs ?? this.config.crawlerDelay.minCardDelayMs;
    const max = maxMs ?? this.config.crawlerDelay.maxCardDelayMs;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const randomMs = Math.floor(Math.random() * (high - low + 1)) + low;
    return new Promise((resolve) => setTimeout(resolve, randomMs));
  }

  /**
   * Phân tích một bản JD thô hoặc đường dẫn do người dùng cung cấp
   */
  public parseCustomJDText(
    title: string,
    company: string,
    rawText: string,
    locationInput?: WorkLocation,
    urlInput?: string,
    cfg?: Partial<SystemConfig>
  ): JobPosting {
    return jobMappingService.mapRawToJobPosting(
      {
        rawTitle: title,
        rawCompany: company,
        rawContent: rawText,
        rawLocation: locationInput,
        linkedinUrl: urlInput,
      },
      cfg
    );
  }
}

export const scraperService = new ScraperService();
