const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findDocFiles(dir, files) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    // 跳过临时文件、隐藏文件、node_modules
    if (item.startsWith('.') || item.startsWith('~$') || item === 'node_modules') return;
    
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findDocFiles(fullPath, files);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (ext === '.docx' || ext === '.doc') {
        files.push(fullPath);
      }
    }
  });
}

function killWordProcesses() {
  try {
    execSync('taskkill /f /im winword.exe', { timeout: 5000 });
  } catch (e) {}
}

function convertWithWord(docPath, retryCount = 0) {
  const pdfPath = docPath.replace(/\.docx$/i, '.pdf').replace(/\.doc$/i, '.pdf');
  
  if (fs.existsSync(pdfPath)) {
    return { success: true, cached: true, pdfPath };
  }
  
  const psScript = `
$docPath = '${docPath.replace(/'/g, "''")}'
$pdfPath = '${pdfPath.replace(/'/g, "''")}'
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($docPath)
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    $doc.Close($false)
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host 'SUCCESS'
} catch {
    if ($doc) { try { $doc.Close($false) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    Write-Host 'ERROR:' $_.Exception.Message
    exit 1
}
`;

  const psScriptPath = path.join(process.cwd(), 'temp_convert_' + Date.now() + '.ps1');
  fs.writeFileSync(psScriptPath, '\uFEFF' + psScript.trim(), 'utf8');

  try {
    execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
      encoding: 'utf8',
      timeout: 120000
    });
    
    if (fs.existsSync(pdfPath)) {
      return { success: true, cached: false, pdfPath };
    } else {
      return { success: false, error: 'PDF not created' };
    }
  } catch (err) {
    if (retryCount < 2) {
      killWordProcesses();
      return convertWithWord(docPath, retryCount + 1);
    }
    return { success: false, error: err.message };
  } finally {
    try { fs.unlinkSync(psScriptPath); } catch (e) {}
  }
}

async function convertAll() {
  const baseDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题');
  const docFiles = [];
  
  console.log('扫描目录...');
  findDocFiles(baseDir, docFiles);
  console.log(`找到 ${docFiles.length} 个 DOCX/DOC 文件`);
  console.log('');
  
  let converted = 0;
  let cached = 0;
  let failed = 0;
  let failedFiles = [];
  
  for (let i = 0; i < docFiles.length; i++) {
    const docPath = docFiles[i];
    const relPath = docPath.replace(baseDir, '');
    
    process.stdout.write(`[${i + 1}/${docFiles.length}] ${relPath.substring(0, 50)}... `);
    
    const result = convertWithWord(docPath);
    
    if (result.success) {
      if (result.cached) {
        cached++;
        process.stdout.write('(已存在)\n');
      } else {
        converted++;
        process.stdout.write('✓\n');
      }
    } else {
      failed++;
      failedFiles.push({ path: relPath, error: result.error });
      process.stdout.write(`✗ ${result.error}\n`);
    }
    
    // 每5个文件暂停一下，释放Word资源
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('');
  console.log('=== 转换完成 ===');
  console.log(`已转换: ${converted}`);
  console.log(`已存在: ${cached}`);
  console.log(`失败: ${failed}`);
  
  if (failedFiles.length > 0) {
    console.log('');
    console.log('失败的文件:');
    failedFiles.forEach(f => console.log(`  ${f.path}: ${f.error}`));
  }
}

convertAll().catch(e => console.error(e));