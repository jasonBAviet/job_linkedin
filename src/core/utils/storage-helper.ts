import fs from "fs";
import path from "path";

/**
 * Tiện ích lưu trữ dữ liệu bền vững (JSON Storage Helper)
 * Đảm bảo dữ liệu thật được lưu trữ trực tiếp vào hệ thống tệp cục bộ (data/)
 */
export class StorageHelper {
  private static getFilePath(filename: string): string {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.error("Không thể tạo thư mục data:", err);
      }
    }
    return path.join(dataDir, filename);
  }

  public static readJson<T>(filename: string, defaultValue: T): T {
    try {
      const filePath = this.getFilePath(filename);
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      if (!raw || raw.trim() === "") {
        return defaultValue;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`Lỗi khi đọc tệp dữ liệu ${filename}:`, error);
      return defaultValue;
    }
  }

  public static writeJson<T>(filename: string, data: T): boolean {
    try {
      const filePath = this.getFilePath(filename);
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonString, "utf-8");
      return true;
    } catch (error) {
      console.error(`Lỗi khi ghi tệp dữ liệu ${filename}:`, error);
      return false;
    }
  }
}
