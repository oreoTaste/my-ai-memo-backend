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
import { FileService } from "src/file/file.service";
import { GetMemoAdviceDto } from "src/memo/dto/memo.dto";
import { GoogleDriveService } from "src/file/google-drive.service";
import { CombinedUploadFile } from "src/file/dto/file.dto";

type DynamicData = { [key: string]: any };

@Injectable()
export class AIAnalyzerService {
  private readonly logger = new Logger(AIAnalyzerService.name);
  private sourceFilePath: string;
  private sourceFiles: { fileName: string; mimeType: string; googleDriveFileId: string }[] = []; // apiKeyToUse 제거
  private fileExtensions: string[] = ["jpeg", "jpg", "png", "jfif", "gif", "webp", "pdf"];
  private targetModel: string;
  private dataList: DynamicData[] = [];
  private allKeys: Set<string> = new Set();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Code) private readonly codeRepository: Repository<Code>,
    @InjectRepository(UploadFile) private readonly fileRepository: Repository<UploadFile>,
    private readonly fileService: FileService,
    private readonly googleDriveService: GoogleDriveService
  ) {
    this.sourceFilePath = this.configService.get<string>("SOURCE_FILE_PATH", "uploads");
    this.targetModel = this.configService.get<string>("TARGET_MODEL", "gemini-1.5-pro-002");
    this.logger.debug(`sourceFilePath : ${this.sourceFilePath}`);
    this.logger.debug(`targetModel : ${this.targetModel}`);
  }

  /* analyze */
  private async fileToGenerativePart(fileName: string, mimeType: string, googleDriveFileId?: string) {
    let fileData: Buffer;
    let resolvedMimeType = mimeType || "image/jpeg";

    if (googleDriveFileId) {
      // Google Drive에서 파일 가져오기
      const { data, mimeType: driveMimeType } = await this.googleDriveService.getGoogleDriveFile(googleDriveFileId);
      fileData = data;
      resolvedMimeType = driveMimeType;
    } else {
      // 로컬 파일 시스템에서 가져오기
      if (!fs.existsSync(fileName)) {
        throw new Error(`File not found: ${fileName}`);
      }
      fileData = fs.readFileSync(fileName);
    }

    return {
      inlineData: {
        data: fileData.toString("base64"),
        mimeType: resolvedMimeType,
      },
    };
  }

  /* getMemoAdvice */
  /* analyze */
  private extractJSON(input: string): string | null {
    const regex = /{[\s\S]*}/; // 전체 JSON 객체를 캡처
    const match = input.match(regex);
  
    if (!match) {
      this.logger.warn("No valid JSON found in response.");
      return null;
    }
  
    let jsonString = match[0];
  
    try {
      JSON.parse(jsonString);
      this.logger.log(`Valid JSON extracted: ${jsonString}`);
      return jsonString;
    } catch (e) {
      this.logger.warn(`Invalid JSON detected: ${jsonString}. Attempting to fix...`);
  
      // 줄바꿈(\n)을 이스케이프하거나 제거
      jsonString = jsonString
        .replace(/([^\\])\\n/g, "$1\\\\n") // \n을 \\n으로 이스케이프 (이미 이스케이프된 경우 제외)
        .replace(/([^"])\n([^"])/g, "$1 $2") // 쌍따옴표 밖의 \n을 공백으로 대체
        .replace(/\s*,\s*/g, ","); // 쉼표 주변 공백 정리
  
      try {
        JSON.parse(jsonString);
        return jsonString;
      } catch (fixError) {
        this.logger.error(`Failed to fix JSON: ${fixError.message}`);
        return null;
      }
    }
  }

  private async makeFile(seq: number, insertId: number): Promise<CombinedUploadFile> {
    const fileDir = `${this.sourceFilePath}/${seq}`;
    const filename = `output.xlsx`;
    const fullFilePath = `${fileDir}/${filename}`;
  
    // 디렉토리 생성 (필요 시)
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
  
    // 헤더와 테이블 데이터 생성
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
  
    // 엑셀 파일 생성
    const worksheet = XLSX.utils.json_to_sheet(tableData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, fullFilePath);
  
    // 파일을 Buffer로 읽기
    const excelBuffer = fs.readFileSync(fullFilePath);
  
    // CombinedUploadFile 객체 생성
    const analyzedFile: CombinedUploadFile = {
      // Express.Multer.File 필수 속성
      fieldname: "file",
      originalname: filename,
      encoding: "7bit",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: excelBuffer.length,
      buffer: excelBuffer,

      // Express.Multer.File 선택적 속성 (디스크 저장소 관련)
      stream: undefined,
      destination: fileDir,
      filename: filename,
      path: fullFilePath,

      // UploadFile 속성
      seq: seq,
      fileName: filename,
      googleDriveFileId: null,

      // 추가 속성
      insertId: insertId,
      updateId: insertId,

      // CommonEntity에서 상속된 속성
      createdAt: new Date(),
      modifiedAt: new Date(),
      memo: undefined
    };
  
    // DB에 저장
    await this.fileRepository.save(analyzedFile);
  
    this.logger.log(`Excel file created: ${fullFilePath}`);
    return analyzedFile;
  }
  
  /* analyze */
  private async processFiles(files: { fileName: string, googleDriveFileId: string }[]) {
    try {
      const returnFiles: { fileName: string; mimeType: string; googleDriveFileId: string }[] = [];
  
      for (const fileMap of files) {
        const fileName = fileMap.fileName;
        const googleDriveFileId = fileMap.googleDriveFileId;
        if (!fileName && !googleDriveFileId) {
          this.logger.warn(`Skipping entry with no fileName in Map`);
          continue;
        }

        if (fileName.endsWith('output.xlsx')) { // file already analyzed will be excepted
          continue;
        }
  
        const isValidFile = this.fileExtensions.some((ext) =>
          fileName.toLowerCase().endsWith(ext)
        );
  
        if (isValidFile) {
          returnFiles.push({
            fileName: fileName,
            mimeType: mime.lookup(fileName) || "image/jpeg",
            googleDriveFileId: googleDriveFileId
          });
        } else {
          this.logger.warn(`Skipping non-valid file: ${fileName}`);
        }
      }
  
      if (files.length === 0) {
        this.logger.warn("No valid files found in the provided fileNames.");
        return;
      }
  
      this.sourceFiles = returnFiles; // API 키는 여기서 할당하지 않음
    } catch (err) {
      this.logger.error(`Error processing fileNames: ${err.message}`, err.stack);
    }
  }

  /* analyze */
  private async analyzeFilesInBatch(batchSize: number = 8) {
    this.dataList = [];
    if (!this.sourceFiles.length) {
      this.logger.warn("No files to analyze.");
      return;
    }

    const usageMap = new Map<string, number>();
    const batches: { fileName: string; mimeType: string; googleDriveFileId: string }[][] = [];
    for (let i = 0; i < this.sourceFiles.length; i += batchSize) {
      batches.push(this.sourceFiles.slice(i, i + batchSize));
    }

    // 필요한 API 호출 횟수 계산
    const requiredCalls = batches.length;
    const selectedKeys = await this.getAPIKeys(requiredCalls);
    let keyIndex = 0;
    let remainingInCurrentKey = 50 - (Number(selectedKeys[0].usage) || 0);

    for (const batch of batches) {
      if (remainingInCurrentKey < 1 && keyIndex < selectedKeys.length - 1) {
        keyIndex++;
        remainingInCurrentKey = 50 - (Number(selectedKeys[keyIndex].usage) || 0);
      }

      const apiKey = selectedKeys[keyIndex].API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: this.targetModel });

      const fileParts = await Promise.all(
        batch.map(({ fileName, mimeType, googleDriveFileId }) =>
          this.fileToGenerativePart(fileName, mimeType, googleDriveFileId)
        )
      );

      const prompt = `
      여러 파일을 분석하여 각 파일에서 추출할 수 있는 속성을 JSON 형태로 반환해줘. 아래 지침을 엄격히 따라줘:
      
      1. **반환 형식**:
         - 파일명을 키로 사용하고, 해당 파일의 속성을 값으로 하는 평평한 객체로 반환해.
         - 속성 이름은 상위 속성과 하위 속성을 "-"로 연결해 중첩 없이 단일 레벨로 표현해 (예: "사업장-소재지").
         - 모든 값은 문자열로 처리하며, 개행 문자(\\n)나 공백을 포함한 단일 문자열로 만들어줘. 개행 문자는 이스케이프된 형태(\\n)로 유지해.
      
      2. **JSON 유효성**:
         - 반환값은 반드시 유효한 JSON 형식이어야 해. 잘못된 구문(예: 누락된 쉼표, 잘못된 이스케이프 등)이 없도록 주의해.
         - 모든 속성과 값은 완전한 키-값 쌍으로 구성되며, 키와 값은 반드시 쌍따옴표로 감싸줘.
      
      3. **파일 처리**:
         - 분석할 파일명은 아래 목록에 명시된 파일만 대상으로 해. 이외의 파일은 무시해.
         - 파일명 목록: ${batch.map(f => f.fileName).join(", ")}
      
      4. **예시**:
         {
           "image1.jpg": {
             "병원명": "여의도 성모 내과",
             "사업의종류": "광고, 홍보 도소매, 컴퓨터 소프트웨어",
             "동공간거리": "62"
           },
           "image2.pdf": {
             "병원명": "강남 안과",
             "사업의종류": "전자상거래, 소프트웨어 개발",
             "좌안-구면렌즈굴절력": "-6.25"
           }
         }
      
      위 형식을 정확히 준수하며, JSON 파싱 오류가 발생하지 않도록 결과를 작성해줘.
      `;
      
      Logger.debug(prompt);
      try {
        const generatedContent = await model.generateContent([prompt, ...fileParts]);
        const jsonString = this.extractJSON(generatedContent.response.text());
        this.logger.debug("jsonString : " + jsonString);
        const generatedJson = jsonString ? JSON.parse(jsonString) : {};

        for (const [fileName, attributes] of Object.entries(generatedJson)) {
          const processedAttributes = Object.fromEntries(
            Object.entries(attributes as object).map(([key, value]) => [
              key,
              typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
            ])
          );
          this.dataList.push({ fileName, ...processedAttributes });
        }

        usageMap.set(apiKey, (usageMap.get(apiKey) || 0) + 1); // 배치당 1회 사용
        remainingInCurrentKey--;
      } catch (error) {
        this.logger.error(`Failed to analyze batch: ${error.message}`);
        batch.forEach(({ fileName }) => {
          this.dataList.push({ fileName, error: "Analysis failed" });
        });
        usageMap.set(apiKey, (usageMap.get(apiKey) || 0) + 1); // 실패해도 호출로 간주
        remainingInCurrentKey--;
      }

      if (batches.length > 1 && batch !== batches[batches.length - 1]) {
        this.logger.log("Waiting 10 seconds before next batch...");
        await this.sleep(10000);
      }
    }

    await this.updateStatusOfAPIKeys(usageMap);
  }

  /* getMemoAdvice */
  private async askFiles(title: string, raws: string, files: Array<Express.Multer.File>): Promise<{ subject: string; advice: string }> {
    const usageMap = new Map<string, number>();
    const selectedKeys = await this.getAPIKeys(1);
    const apiKey = selectedKeys[0].API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.targetModel });
  
    const fileParts = files.map(file => {
      if (!file.path) {
        throw new Error(`File path is missing for ${file.originalname}`);
      }
      const buffer = fs.readFileSync(file.path);  // 디스크에서 파일 읽기
      return {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.mimetype || mime.lookup(file.originalname) || "application/octet-stream"
        }
      };
    });    

    const ynFile = (files === null || files.length <= 0);
    const prompt = `
      아래 제목, 본문${ynFile ? ", 그리고 파일를": "을"} 통해 주제를 요약하고, 이에 대한 조언을 한글로 작성해줘.
      결과는 반드시 JSON 형식으로 반환하며, "subject"와 "advice" 두 키를 포함해야 해.
      - "subject": 본문 ${ ynFile ? "과 파일" : "" }에서 도출된 주제 요약 (짧고 명확하게).
      - "advice": 본문 ${ ynFile ? "과 파일" : "" }에서 도출한 구체적인 조언 (자연스럽게).
      잘못된 JSON 형식이 되지 않도록 주의하고, JSON만 반환해줘 (추가 텍스트 없음).
      -------------------------------------------------------------
      제목: "${title}"
      본문: "${raws}"
      ${ynFile ? "" : "파일명 목록: "}${files.map(f => Buffer.from(f.originalname, 'latin1').toString('utf8')).join(", ")}
      -------------------------------------------------------------
      예시:
      {
        "subject": "사업체 업종 분석",
        "advice": "가나소프트는 소프트웨어 개발 업종, 마커스코리아는 전자상거래와 광고 업종에 속합니다."
      }
    `;
    Logger.debug(prompt);
  
    try {
      const generatedContent = await model.generateContent([prompt, ...fileParts]);
      const jsonString = this.extractJSON(generatedContent.response.text());
      this.logger.log(`Raws answer: ${jsonString}`);
  
      // JSON 파싱
      const parsedResult = JSON.parse(jsonString);

      // subject와 advice만 추출
      const result = {
        subject: parsedResult.subject || "알 수 없음",
        advice: parsedResult.advice || "조언을 생성할 수 없습니다.",
      };


      usageMap.set(apiKey, 1);
      await this.updateStatusOfAPIKeys(usageMap);
  
      return result;
    } catch (error) {
      this.logger.error(`Failed to ask photos: ${error.message}`);
      const fallback = {
        subject: "분석 실패",
        advice: `오류 발생: ${error.message}`,
      };
  
      usageMap.set(apiKey, 1);
      await this.updateStatusOfAPIKeys(usageMap);
  
      return fallback;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* getAPIkey */
  /* analyze */
  public async getAPIKeys(countTobeUsed: number = 1): Promise<{ usage: number, API_KEY: string }[]> {
    const apiKeys = await this.codeRepository.find({
      where: { codeGroup: "CC004", code: Like("API_KEY%"), useYn: "Y" },
      order: { code: "ASC" },
      comment: "AIAnalyzerService.getAPIKeys"
    });

    if (apiKeys.length === 0) {
      this.logger.error("No valid GOOGLE_API_KEY found");
      throw new Error("No valid GOOGLE_API_KEY found");
    }

    const availableKeys = apiKeys.filter((key) => (Number(key.codeDesc) || 0) < 50); // 50번 미만으로 수정
    let totalRemaining = availableKeys.reduce((sum, key) => sum + (50 - (Number(key.codeDesc) || 0)), 0);

    if (totalRemaining < countTobeUsed) {
      this.logger.error(`Total remaining usage (${totalRemaining}) is less than required (${countTobeUsed})`);
      throw new Error("Insufficient total remaining usage across all keys");
    }

    const selectedKeys: { usage: number, API_KEY: string }[] = [];
    let remainingCount = countTobeUsed;
    for (const key of availableKeys) {
      const keyRemaining = 50 - (Number(key.codeDesc) || 0);
      if (remainingCount > 0) {
        selectedKeys.push({ usage: Number(key.codeDesc) || 0, API_KEY: key.remark });
        remainingCount -= Math.min(keyRemaining, remainingCount);
      }
      if (remainingCount <= 0) break;
    }

    this.logger.log(`Allocated ${selectedKeys.length} keys for ${countTobeUsed} calls`);
    return selectedKeys;
  }

  /* getAPIkey */
  /* getMemoAdvice */
  public async updateStatusOfAPIKeys(usageMap: Map<string, number>): Promise<void> {
    await this.codeRepository.manager.transaction(async (manager) => {
      for (const [apiKey, count] of usageMap) {
        await manager
          .createQueryBuilder()
          .update(Code)
          .set({
            codeDesc: () => `TO_CHAR((TO_NUMBER(CODE_DESC) + ${count}))`
          })
          .where({
            codeGroup: "CC004",
            code: Like("API_KEY%"),
            remark: apiKey,
            useYn: "Y"
          })
          .comment("AIAnalyzerService.updateStatusOfAPIKeys")
          .execute();
      }
    });
  }

  /* analyze */
  public async analyzeFiles(files: { fileName: string, googleDriveFileId: string }[], seq: number, insertId: number, batchSize: number = 5) {
    this.logger.log("Starting file analysis...");
    await this.processFiles(files);
    this.logger.log(`Found ${this.sourceFiles.length} files`);
    await this.analyzeFilesInBatch(batchSize);
    this.logger.log(`Analyzed ${this.dataList.length} files`);
    let analyzedFile = await this.makeFile(seq, insertId);
    await this.fileService.uploadToGoogleDrive([analyzedFile]);
    this.logger.log("File analysis completed");
  }

  /* getMemoAdvice */
  public async getAdvice({raws, title}: GetMemoAdviceDto, files: Array<Express.Multer.File>): Promise<{ subject: string; advice: string }> {
    try {
      let result = await this.askFiles(title, raws, files);
      this.logger.log(`File analysis completed, 주제: ${result.subject}, 조언: ${result.advice}`);
      return result;  
    } catch(e) {
      return {subject:"오류", advice: e}
    }
  }

}