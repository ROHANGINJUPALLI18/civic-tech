const fs = require("fs");

async function main() {
  const imagePath =
    "D:/civic-tech/civic/data/uploads/complaint-1771608733331-47456.jpg";
  const fd = new FormData();
  fd.append("reporterName", "Test User");
  fd.append("title", "Test complaint");
  fd.append("description", "Road issue");
  fd.append("category", "Pothole");
  fd.append("ward", "Ward 12");
  fd.append(
    "complaintImage",
    new Blob([fs.readFileSync(imagePath)]),
    "test.jpg",
  );

  const response = await fetch("http://localhost:3000/api/complaints", {
    method: "POST",
    body: fd,
  });

  console.log("STATUS", response.status);
  console.log(await response.text());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
