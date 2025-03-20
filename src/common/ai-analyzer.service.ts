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

type DynamicData = { [key: string]: any };

@Injectable()
export class AIAnalyzerService {
  private readonly logger = new Logger(AIAnalyzerService.name);
  private sourceFilePath: string;
  private sourceFileNames: { fileName: string; mimeType: string }[] = []; // apiKeyToUse 제거
  private fileExtensions: string[] = ["jpeg", "jpg", "png", "jfif", "gif", "webp", "pdf"];
  private targetModel: string;
  private dataList: DynamicData[] = [];
  private allKeys: Set<string> = new Set();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Code) private readonly codeRepository: Repository<Code>,
    @InjectRepository(UploadFile) private readonly fileRepository: Repository<UploadFile>,
    private readonly fileService: FileService,
  ) {
    this.sourceFilePath = this.configService.get<string>("SOURCE_FILE_PATH", "uploads");
    this.targetModel = this.configService.get<string>("TARGET_MODEL", "gemini-1.5-pro-002");
    this.logger.debug(`sourceFilePath : ${this.sourceFilePath}`);
    this.logger.debug(`targetModel : ${this.targetModel}`);
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
    if (!match) {
      this.logger.warn("No valid JSON found in response.");
      return null;
    }
  
    let jsonString = match[0];
    try {
      JSON.parse(jsonString);
      return jsonString;
    } catch (e) {
      this.logger.warn(`Invalid JSON detected: ${jsonString}. Attempting to fix...`);
      jsonString = jsonString.replace(/,\s*"([^"]+)"\s*:/g, (match, key) => `, "${key}": `).replace(/\n/g, ", ");
      try {
        JSON.parse(jsonString);
        this.logger.log(`Fixed JSON: ${jsonString}`);
        return jsonString;
      } catch (fixError) {
        this.logger.error(`Failed to fix JSON: ${fixError.message}`);
        return null;
      }
    }
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
  
      for (const fileMap of fileNames) {
        const fileName = fileMap.fileName;
        if (!fileName) {
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
          files.push({
            fileName: fileName,
            mimeType: mime.lookup(fileName) || "image/jpeg",
          });
        } else {
          this.logger.warn(`Skipping non-valid file: ${fileName}`);
        }
      }
  
      if (files.length === 0) {
        this.logger.warn("No valid files found in the provided fileNames.");
        return;
      }
  
      this.sourceFileNames = files; // API 키는 여기서 할당하지 않음
    } catch (err) {
      this.logger.error(`Error processing fileNames: ${err.message}`, err.stack);
    }
  }

  private async analyzeFilesInBatch(batchSize: number = 5) {
    if (!this.sourceFileNames.length) {
      this.logger.warn("No files to analyze.");
      return;
    }

    const usageMap = new Map<string, number>();
    const batches: { fileName: string; mimeType: string }[][] = [];
    for (let i = 0; i < this.sourceFileNames.length; i += batchSize) {
      batches.push(this.sourceFileNames.slice(i, i + batchSize));
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

      const fileParts = batch.map(({ fileName, mimeType }) =>
        this.fileToGenerativePart(fileName, mimeType)
      );

      const prompt = `
        여러 파일을 분석하여 각 파일에서 뽑아낼 수 있는 속성을 JSON 형태로 반환해줘.
        반환 형식은 파일명을 키로 하고, 해당 파일의 속성을 평평한 객체로 만들어 한글로 대답해.
        속성 이름은 상위 속성과 하위 속성을 "-"로 연결해 중첩 없이 한 겹으로 표현해.
        모든 값은 문자열로 처리하며, 개행 문자(\\n)나 공백은 하나의 값 안에 포함시켜 단일 문자열로 만들어줘.
        잘못된 JSON 형식이 되지 않도록 주의하고, 모든 속성과 값이 완전한 키-값 쌍으로 구성되게 해줘.
        예시:
        {
          "image1.jpg": {"병원명": "여의도 성모 내과", "사업의종류": "광고, 홍보 도소매, 컴퓨터 소프트웨어", "동공간거리": "62"},
          "image2.pdf": {"병원명": "강남 안과", "사업의종류": "전자상거래, 소프트웨어 개발", "좌안-구면렌즈굴절력": "-6.25"}
        }
        아래는 분석할 파일명 목록이야:
        ${batch.map(f => this.fileService.getRealFileName(f.fileName)).join(", ")}
      `;
      
      try {
        const generatedContent = await model.generateContent([prompt, ...fileParts]);
        const jsonString = this.extractJSON(generatedContent.response.text());
        this.logger.log("jsonString : " + jsonString);
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
    // const fileParts = files.map(file => ({
    //   inlineData: {
    //     data: file.buffer.toString("base64"),
    //     mimeType: file.mimetype || mime.lookup(file.originalname) || "application/octet-stream"  // false 방지
    //   },
    // }));

    const ynFile = (files === null || files.length <= 0);
  
    const prompt = `
      아래 제목, 본문${ynFile ? ", 그리고 파일를": "을"} 통해 주제를 요약하고, 이에 대한 조언을 한글로 작성해줘.
      결과는 반드시 JSON 형식으로 반환하며, "subject"와 "advice" 두 키를 포함해야 해.
      - "subject": 본문 ${ ynFile ? "과 파일" : "" }에서 도출된 주제 요약 (짧고 명확하게).
      - "advice": 본문 ${ ynFile ? "과 파일" : "" }에서 도출한 구체적인 조언 (자연스럽게).
      잘못된 JSON 형식이 되지 않도록 주의하고, JSON만 반환해줘 (추가 텍스트 없음).
      제목: "${title}"
      본문: "${raws}"
      ${ynFile ? "" : "파일명 목록:"}
      ${files.map(f => f.originalname).join(", ")}
      예시:
      {
        "subject": "사업체 업종 분석",
        "advice": "가나소프트는 소프트웨어 개발 업종, 마커스코리아는 전자상거래와 광고 업종에 속합니다."
      }
    `;
  
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

  public async getAPIKeys(countTobeUsed: number = 1): Promise<{ usage: number, API_KEY: string }[]> {
    const apiKeys = await this.codeRepository.find({
      where: { codeGroup: "CC004", code: Like("API_KEY%"), useYn: "Y" },
      order: { code: "ASC" },
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
          .execute();
      }
    });
  }

  public async analyzeFiles(fileNames: { fileName: string }[], seq: number, insertId: number, batchSize: number = 5) {
    this.logger.log("Starting file analysis...");
    await this.processFiles(fileNames);
    this.logger.log(`Found ${this.sourceFileNames.length} files`);
    await this.analyzeFilesInBatch(batchSize);
    this.logger.log(`Analyzed ${this.dataList.length} files`);
    await this.makeFile(seq, insertId);
    this.logger.log("File analysis completed");
  }

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