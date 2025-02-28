import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";
import * as fs from "fs";
import { Buffer } from "buffer";
import * as mime from "mime-types";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import { Code } from "src/code/entity/code.entity";
import { UploadFile } from "src/file/entity/file.entity";

type DynamicData = { [key: string]: any };

@Injectable()
export class ImageAnalyzerService {
  private readonly logger = new Logger(ImageAnalyzerService.name);
  private sourceFilePath: string;
  private sourceFileNames: { fileName: string; mimeType: string; apiKeyToUse: string }[] = [];
  private imageExtensions: string[] = ["jpeg", "jpg", "png", "jfif", "gif", "webp"];
  private targetModel: string;
  private dataList: DynamicData[] = [];
  private allKeys: Set<string> = new Set();

  constructor(
    private configService: ConfigService,
    @InjectRepository(Code) private codeRepository: Repository<Code>,
    @InjectRepository(UploadFile) private fileRepository: Repository<UploadFile>,
  ) {
    this.sourceFilePath = this.configService.get<string>("SOURCE_FILE_PATH", "uploads");
    this.targetModel = this.configService.get<string>("TARGET_MODEL", "gemini-1.5-pro");
  }

  private fileToGenerativePart(fileName: string, mimeType: string) {
    if (!fs.existsSync(fileName)) {
      throw new Error(`File not found: ${fileName}`);
    }
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(fileName)).toString("base64"),
        mimeType: mimeType || "image/jpeg",
      },
    };
  }

  private extractJSON(input: string): string | null {
    const regex = /{[\s\S]*}/;
    const match = input.match(regex);
    return match ? match[0] : null;
  }

  private async makeFile(seq: number, insertId: number) {
    let destFileName = `${this.sourceFilePath}/${insertId}_${seq}_output.xlsx`;

    this.dataList.forEach((data) => {
      Object.keys(data).forEach((key) => this.allKeys.add(key));
    });
    const headers: string[] = Array.from(this.allKeys).sort();
    const tableData: { [key: string]: string }[] = this.dataList.map((data) => {
      const row: { [key: string]: string } = {};
      headers.forEach((header) => {
        row[header] = String(data[header] ?? "");
      });
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(tableData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, destFileName);

    let newFile = new UploadFile();
    newFile.fileName = destFileName;
    newFile.fileFrom = "MEMO";
    newFile.insertId = newFile.updateId = insertId;
    newFile.seq = seq;
    await this.fileRepository.save(newFile);

    this.logger.log(`Excel file created: ${destFileName}`);
  }

  private async processFiles(fileNames: { fileName: string }[]) {
    try {
      const files: { fileName: string; mimeType: string }[] = [];
  
      // 입력받은 fileNames 배열을 순회하며 유효성 검사 및 정보 추출
      for (const fileMap of fileNames) {
        const fileName = fileMap.fileName;
        if (!fileName) {
          this.logger.warn(`Skipping entry with no fileName in Map`);
          continue;
        }
  
        const isValidImage = this.imageExtensions.some((ext) =>
          fileName.toLowerCase().endsWith(ext)
        );
  
        if (isValidImage) {
          files.push({
            fileName: fileName,
            mimeType: mime.lookup(fileName) || "image/jpeg", // MIME 타입 추정
          });
        } else {
          this.logger.warn(`Skipping non-image file: ${fileName}`);
        }
      }
  
      if (files.length === 0) {
        this.logger.warn("No valid image files found in the provided fileNames.");
        return;
      }
  
      // API 키 할당 로직 (기존 그대로 유지)
      const selectedKeys = await this.getAPIKeys(files.length);
      let keyIndex = 0;
      let remainingInCurrentKey = 49 - (Number(selectedKeys[0].usage) || 0);
  
      for (const file of files) {
        if (remainingInCurrentKey <= 0 && keyIndex < selectedKeys.length - 1) {
          keyIndex++;
          remainingInCurrentKey = 49 - (Number(selectedKeys[keyIndex].usage) || 0);
        }
        this.sourceFileNames.push({
          ...file,
          apiKeyToUse: selectedKeys[keyIndex].API_KEY, // remark가 실제 API 키
        });
        remainingInCurrentKey--;
      }
    } catch (err) {
      this.logger.error(`Error processing fileNames: ${err.message}`, err.stack);
    }
  }

  private async processDirectory() {
    try {
      const dir = await this.openDirAsync(this.sourceFilePath);
      let file: fs.Dirent | null;
      const files: { fileName: string; mimeType: string }[] = [];

      while ((file = await this.readDirAsync(dir)) !== null) {
        if (file.isFile() && this.imageExtensions.some((el) => file.name.toLowerCase().endsWith(el))) {
          files.push({
            fileName: file.name,
            mimeType: mime.lookup(file.name) || "image/jpeg",
          });
        }
      }
      await dir.close();

      // API 키 할당
      const selectedKeys = await this.getAPIKeys(files.length);
      let keyIndex = 0;
      let remainingInCurrentKey = 49 - (Number(selectedKeys[0].usage) || 0);

      for (const file of files) {
        if (remainingInCurrentKey <= 0 && keyIndex < selectedKeys.length - 1) {
          keyIndex++;
          remainingInCurrentKey = 49 - (Number(selectedKeys[keyIndex].usage) || 0);
        }
        this.sourceFileNames.push({
          ...file,
          apiKeyToUse: selectedKeys[keyIndex].API_KEY, // remark가 실제 API 키
        });
        remainingInCurrentKey--;
      }
    } catch (err) {
      this.logger.error(`Error processing directory: ${err.message}`, err.stack);
    }
  }

  private async analyzePhoto() {
    const prompt = '이미지에서 뽑아낼 수 있는 속성을 JSON 형태로, 중첩 객체 없이 한 겹으로만 만들어서 한글로 대답해줘. 속성 이름은 상위 속성과 하위 속성을 "-"로 연결해 평평하게 표현해. (예시: {"병원명": "여의도 성모 내과", "우안-구면렌즈굴절력": -8.00, "우안-난시축": 175, "좌안-구면렌즈굴절력": -6.25, "동공간거리": 62})';
    const usageMap = new Map<string, number>(); // API 키별 성공 횟수 집계
  
    for (const [index, { fileName, mimeType, apiKeyToUse }] of this.sourceFileNames.entries()) {
      const genAI = new GoogleGenerativeAI(apiKeyToUse);
      const model = genAI.getGenerativeModel({ model: this.targetModel });
      const imageParts = [this.fileToGenerativePart(fileName, mimeType)];
  
      try {
        const generatedContent = await model.generateContent([prompt, ...imageParts]);
        const jsonString = this.extractJSON(generatedContent.response.text());
        this.logger.log("jsonString : " + jsonString);
        const generatedJson = jsonString ? JSON.parse(jsonString) : {};

        this.logger.log("generatedJson : " + generatedJson);

        // 값이 객체일 경우 문자열로 변환
        const processedJson = Object.fromEntries(
          Object.entries(generatedJson).map(([key, value]) => [
            key,
            typeof value === 'object' && value !== null ? JSON.stringify(value) : value
          ])
        );

        this.logger.log("processedJson : " + processedJson);
        this.dataList.push(processedJson);
  
        // 성공 횟수 집계
        usageMap.set(apiKeyToUse, (usageMap.get(apiKeyToUse) || 0) + 1);
      } catch (error) {
        this.logger.error(`Failed to analyze ${fileName}: ${error.message}`);
      }
  
      // 파일이 1개 이상이고 마지막 파일이 아니면 10초 대기
      if (this.sourceFileNames.length > 1 && index < this.sourceFileNames.length - 1) {
        this.logger.log(`Processed ${fileName}, waiting 10 seconds...`);
        await this.sleep(10000); // 10000ms = 10초
      }
    }
  
    // codeDesc (사용 횟수) 업데이트
    await this.updateStatusOfAPIKeys(usageMap);
  }
  
  // sleep 헬퍼 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private openDirAsync(path: string): Promise<fs.Dir> {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
    return new Promise((resolve, reject) => {
      fs.opendir(path, (err, dir) => {
        if (err) reject(err);
        else resolve(dir);
      });
    });
  }

  private readDirAsync(dir: fs.Dir): Promise<fs.Dirent | null> {
    return new Promise((resolve, reject) => {
      dir.read((err, file) => {
        if (err) reject(err);
        else resolve(file);
      });
    });
  }

  /**
   * 사용횟수에 맞는 API 키를 추출한다
   * @param countTobeUsed - 사용횟수 (number)
   */
  public async getAPIKeys(countTobeUsed: number = 1):Promise<{usage: number, API_KEY: string}[]> {
    const apiKeys = await this.codeRepository.find({
      where: { codeGroup: "CC004", code: Like("API_KEY%"), useYn: "Y" },
      order: { code: "ASC" }, // 순서대로 사용
    });

    if (apiKeys.length === 0) {
      this.logger.error("No valid GOOGLE_API_KEY found");
      throw new Error("No valid GOOGLE_API_KEY found");
    }

    // 사용 가능한 키 확인 (codeDesc는 사용 횟수)
    const availableKeys = apiKeys.filter((key) => (Number(key.codeDesc) || 0) < 49);
    let totalRemaining = availableKeys.reduce((sum, key) => sum + (49 - (Number(key.codeDesc) || 0)), 0);

    if (totalRemaining < countTobeUsed) {
      this.logger.error(`Total remaining usage (${totalRemaining}) is less than required (${countTobeUsed})`);
      throw new Error("Insufficient total remaining usage across all keys");
    }

    const selectedKeys: {usage: number, API_KEY: string}[] = [];
    let remainingCount = countTobeUsed;
    for (const key of availableKeys) {
      const keyRemaining = 49 - (Number(key.codeDesc) || 0);
      if (remainingCount > 0) {
        selectedKeys.push({usage: Number(key.codeDesc) || 0, API_KEY: key.remark});
        remainingCount -= Math.min(keyRemaining, remainingCount);
      }
      if (remainingCount <= 0) break;
    }

    this.logger.log(`Allocated ${selectedKeys.length} keys for ${countTobeUsed} calls`);
    return selectedKeys;
  }

  /**
   * API 키의 사용횟수를 차감한다.
   * @param usageMap - API 키(문자열)와 사용 횟수(숫자)를 포함한 Map
   * @example
   * const usageMap = new Map([
   *   ["API_KEY_123", 5],
   *   ["API_KEY_456", 10]
   * ]);
   */
  public async updateStatusOfAPIKeys(usageMap: Map<string, number>):Promise<void> {
    await this.codeRepository.manager.transaction(async (manager) => {
      // codeDesc (사용 횟수) 업데이트
      for (const [apiKey, count] of usageMap) {
        await manager
        .createQueryBuilder()
        .update(Code)
        .set({
          codeDesc: () => `TO_CHAR((TO_NUMBER(codeDesc) + ${count}))`
        })
        .where({
          codeGroup: "CC004",
          code: Like("API_KEY%"),
          remark: apiKey,
          useYn: "Y"
        })
        .execute();
      }
    });
  }

  public async run(fileNames: { fileName: string }[], seq: number, insertId: number) {
    this.logger.log("Starting file analysis...");
    if(fileNames === null || fileNames.length == 0) {
      await this.processDirectory();
    } else {
      await this.processFiles(fileNames);
    }
    this.logger.log(`Found ${this.sourceFileNames.length} image files`);
    await this.analyzePhoto();
    this.logger.log(`Analyzed ${this.dataList.length} files`);
    await this.makeFile(seq, insertId);
    this.logger.log("File analysis completed");
  }
}