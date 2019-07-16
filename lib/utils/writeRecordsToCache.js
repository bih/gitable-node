const fs = require('fs-extra');

export default async function writeRecordsToCache({
  writeFolder,
  writePrefix = null,
  page,
  records,
}) {
  const fileName = writePrefix
    ? `${writeFolder}${writePrefix}.${page}.json`
    : `${writeFolder}${page}.json`;

  return await fs.writeFileSync(
    fileName,
    JSON.stringify({
      page,
      timestamp: +new Date(),
      records: records.map(record =>
        record.fields ? Object.assign(record.fields, { id: record.id }) : record
      ),
    })
  );
}
