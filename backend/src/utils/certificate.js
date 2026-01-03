const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Generate certificate PDF
exports.generateCertificatePDF = async (certificateData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        userName,
        eventName,
        eventDate,
        certificateNumber,
        verificationCode,
        type,
        position,
        issuedBy,
      } = certificateData;

      // Create PDF document
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const fileName = `${uuidv4()}.pdf`;
      const filePath = path.join(
        __dirname,
        "../../uploads/certificates",
        fileName
      );

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Add border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
      doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke();

      // Add header
      doc
        .fontSize(40)
        .font("Helvetica-Bold")
        .text("Certificate of Achievement", 50, 100, {
          align: "center",
        });

      // Certificate type
      const typeText =
        type === "winner"
          ? "Winner Certificate"
          : type === "runner_up"
          ? "Runner Up Certificate"
          : type === "participation"
          ? "Participation Certificate"
          : type === "volunteer"
          ? "Volunteer Certificate"
          : type === "organizer"
          ? "Organizer Certificate"
          : "Certificate";

      doc.fontSize(16).font("Helvetica").text(typeText, 50, 160, {
        align: "center",
      });

      // This is to certify that
      doc
        .fontSize(18)
        .font("Helvetica")
        .text("This is to certify that", 50, 220, {
          align: "center",
        });

      // User name
      doc.fontSize(32).font("Helvetica-Bold").text(userName, 50, 260, {
        align: "center",
      });

      // Achievement text
      let achievementText = `has successfully participated in`;
      if (type === "winner") {
        achievementText = `has secured ${
          position
            ? `${position}${getOrdinalSuffix(position)} position`
            : "Winner position"
        } in`;
      } else if (type === "runner_up") {
        achievementText = `has been awarded Runner Up in`;
      } else if (type === "volunteer") {
        achievementText = `has volunteered for`;
      } else if (type === "organizer") {
        achievementText = `has organized`;
      }

      doc.fontSize(16).font("Helvetica").text(achievementText, 50, 320, {
        align: "center",
      });

      // Event name
      doc.fontSize(24).font("Helvetica-Bold").text(eventName, 50, 360, {
        align: "center",
      });

      // Event date
      doc
        .fontSize(14)
        .font("Helvetica")
        .text(
          `Held on ${new Date(eventDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          50,
          410,
          {
            align: "center",
          }
        );

      // Certificate number
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Certificate No: ${certificateNumber}`, 50, 480, {
          align: "left",
        });

      // Issued by
      doc
        .fontSize(10)
        .text(`Issued By: ${issuedBy}`, doc.page.width - 250, 480, {
          align: "left",
        });

      // Generate QR code
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-certificate/${verificationCode}`;
      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
      const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");

      // Add QR code
      doc.image(qrCodeBuffer, 50, 510, { width: 80, height: 80 });
      doc
        .fontSize(8)
        .text("Scan to verify", 50, 595, { width: 80, align: "center" });

      // Signature line
      doc
        .moveTo(doc.page.width - 250, 560)
        .lineTo(doc.page.width - 100, 560)
        .stroke();
      doc.fontSize(10).text("Authorized Signature", doc.page.width - 250, 565, {
        width: 150,
        align: "center",
      });

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          "This is a digitally generated certificate",
          50,
          doc.page.height - 40,
          {
            align: "center",
          }
        );

      // Finalize PDF
      doc.end();

      writeStream.on("finish", () => {
        resolve({
          fileName,
          filePath,
          url: `/uploads/certificates/${fileName}`,
        });
      });

      writeStream.on("error", (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Helper function for ordinal suffix
const getOrdinalSuffix = (num) => {
  const j = num % 10;
  const k = num % 100;
  if (j == 1 && k != 11) return "st";
  if (j == 2 && k != 12) return "nd";
  if (j == 3 && k != 13) return "rd";
  return "th";
};

// Generate QR code
exports.generateQRCode = async (data) => {
  try {
    const qrCode = await QRCode.toDataURL(data);
    return qrCode;
  } catch (error) {
    throw new Error("QR code generation failed");
  }
};

// Verify certificate
exports.verifyCertificateCode = (code) => {
  // Add additional verification logic if needed
  return code && code.length === 32;
};

module.exports = exports;
