import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
const { PDFParse } = await import("pdf-parse");
const pdfParse = PDFParse;

// Keep imports clean for the existing setup
export function registerPdfTools(server: McpServer) {
    server.tool(
        "extract_pdf_text",
        {
            filePath: z.string().describe("Absolute or relative path to the PDF file to extract text from"),
            maxPages: z.number().optional().describe("Maximum number of pages to extract (to prevent massive output over context limits)"),
        },
        async ({ filePath, maxPages }) => {
            try {
                const absolutePath = path.resolve(process.cwd(), filePath);
                console.error(`Attempting to read PDF from: ${absolutePath}`);
                
                try {
                    await fs.access(absolutePath);
                } catch {
                    return {
                        content: [
                            { type: "text", text: `Error: File not found at ${absolutePath}\nPlease provide a valid local path on the machine running this MCP server.` }
                        ],
                        isError: true
                    };
                }

                const dataBuffer = await fs.readFile(absolutePath);
                
                // Using pdf-parse v2
                const parser = new PDFParse({ data: dataBuffer });
                
                // Get metadata
                const infoData = await parser.getInfo();
                
                // Get text
                const textData = await parser.getText();
                
                // Return structured info: pages, metadata, and the extracted text
                const result = `=== PDF Extraction Report ===
File: ${path.basename(absolutePath)}
Total Pages in doc: ${infoData.total}
Info: ${JSON.stringify(infoData.info || {})}

=== Text Content ===
${textData.text}
`;
                return {
                    content: [
                        { type: "text", text: result }
                    ]
                };

            } catch (error) {
                return {
                    content: [
                        { type: "text", text: `Failed to extract PDF: ${error instanceof Error ? error.message : String(error)}` }
                    ],
                    isError: true
                };
            }
        }
    );
}