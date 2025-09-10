// A pré-visualização é atualizada automaticamente a cada alteração na lista de arquivos,
// não sendo necessário (nem exibido) um botão específico para esta função.

// Seleção dos elementos da interface
const selectFilesBtn = document.getElementById("selectFilesBtn");
const fileInput = document.getElementById("fileInput");
const feedbackContainer = document.getElementById("feedbackContainer");
const groupsContainer = document.getElementById("groupsContainer");
const completedList = document.getElementById("completedList");

// Variável isFolderMode (pode ser removida se não for utilizada)
let isFolderMode = true;
let allFiles = []; // Array para armazenar os arquivos selecionados (objeto: { file, name })

// Evento para disparar a seleção de arquivos
selectFilesBtn.addEventListener("click", () => {
  isFolderMode = false;
  fileInput.removeAttribute("webkitdirectory");
  fileInput.click();
});

// Ao selecionar arquivos, processa a seleção
fileInput.addEventListener("change", handleFileSelection);

function handleFileSelection() {
  clearFeedback();
  const files = Array.from(fileInput.files);

  if (files.length === 0) {
    showFeedback("Nenhum arquivo selecionado.", "error");
    return;
  }

  // Definição dos tipos permitidos
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
  const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];

  // Filtrando apenas os arquivos permitidos
  const validFiles = files.filter((file) => {
    const isValidType = allowedTypes.includes(file.type);
    const isValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );
    return isValidType && isValidExtension;
  });

  if (validFiles.length === 0) {
    showFeedback("Arquivos inválidos! Selecione apenas PDFs, PNGs ou JPEGs.", "error");
    return;
  }

  // Adiciona os arquivos validados à lista, evitando duplicatas
  validFiles.forEach((file) => {
    if (!allFiles.some((f) => f.file.name === file.name)) {
      allFiles.push({ file, name: file.name });
    }
  });

  renderGroups();
}

// Função para renderizar ou atualizar os grupos existentes
function renderGroups() {
  // Verifica se já existe um grupo (único grupo nesta implementação)
  let groupContainer = groupsContainer.querySelector(".group-container");

  if (!groupContainer) {
    groupContainer = document.createElement("div");
    groupContainer.classList.add("group-container");

    const title = document.createElement("h2");
    title.textContent = "Arquivos Selecionados";
    groupContainer.appendChild(title);

    const list = document.createElement("ul");
    list.classList.add("file-list");
    groupContainer.appendChild(list);

    // Ativa a ordenação com SortableJS
    Sortable.create(list, {
      animation: 150,
      onUpdate: function () {
        const items = Array.from(list.children);
        const newOrderFiles = items.map((item) => {
          const filename = item.getAttribute("data-filename");
          return allFiles.find((file) => file.name === filename);
        });
        allFiles = newOrderFiles;
        updateFileList(list);
      }
    });

    // Botão para mesclar os PDFs do grupo
    const mergeButton = document.createElement("button");
    mergeButton.textContent = "Mesclar PDFs";
    mergeButton.addEventListener("click", () => mergeGroup(groupContainer, list));
    groupContainer.appendChild(mergeButton);

    groupsContainer.appendChild(groupContainer);
  }

  // Atualiza a lista de arquivos exibida
  const fileList = groupContainer.querySelector(".file-list");
  updateFileList(fileList);
}

// Função para atualizar a lista de arquivos exibida e atualizar a pré-visualização
function updateFileList(list) {
  list.innerHTML = "";
  allFiles.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f.name;
    // Usamos data-filename para identificar unicamente o item
    li.setAttribute("data-filename", f.name);

    // Botão para remover o arquivo da lista
    const removeButton = document.createElement("button");
    removeButton.classList.add("remove-btn");
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      const indexToRemove = allFiles.findIndex((file) => file.name === f.name);
      if (indexToRemove !== -1) {
        allFiles.splice(indexToRemove, 1);
      }
      if (allFiles.length === 0) {
        list.closest(".group-container").remove();
      } else {
        updateFileList(list);
      }
      // Atualiza a pré-visualização após a remoção
      previewMergedPDF();
    });

    li.appendChild(removeButton);
    list.appendChild(li);
  });
  // Atualiza a pré-visualização sempre que a lista for atualizada
  previewMergedPDF();
}

// Função para mesclar os PDFs do grupo e gerar o link para download
async function mergeGroup(groupContainer, list) {
  if (allFiles.length === 0) {
    showFeedback("Nenhum arquivo para mesclar.", "error");
    return;
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const fileObj of allFiles) {
    try {
      const arrayBuffer = await fileObj.file.arrayBuffer();
      const fileType = fileObj.file.type;

      if (fileType === "application/pdf") {
        // Se for PDF, copia as páginas normalmente
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } else if (fileType === "image/png" || fileType === "image/jpeg") {
        // Se for imagem, converte para uma página do PDF
        const image = fileType === "image/png" 
          ? await mergedPdf.embedPng(arrayBuffer)
          : await mergedPdf.embedJpg(arrayBuffer);

        const page = mergedPdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      } else {
        showFeedback(`Formato inválido: ${fileObj.name}`, "error");
        return;
      }
    } catch (err) {
      showFeedback(`Erro ao processar o arquivo ${fileObj.name}.`, "error");
      console.error(err);
      return;
    }
  }

  // Salva o PDF final e cria um Blob com os bytes gerados
  const mergedPdfBytes = await mergedPdf.save();
  const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  // Verifica se já existe um botão de download e, se sim, atualiza-o
  let downloadBtn = groupContainer.querySelector(".download-btn");
  if (downloadBtn) {
    // Atualiza o link para o novo PDF mesclado
    downloadBtn.href = url;
  } else {
    // Caso não exista, cria o botão de download
    downloadBtn = document.createElement("a");
    downloadBtn.href = url;
    downloadBtn.download = "mesclado.pdf";
    downloadBtn.textContent = "Baixar PDF Combinado";
    downloadBtn.classList.add("download-btn");
    downloadBtn.addEventListener("click", () => {
      const completedItem = document.createElement("li");
      completedItem.textContent = `PDF mesclado criado em ${new Date().toLocaleString()}`;
      completedList.appendChild(completedItem);
      groupContainer.remove();
      allFiles = []; // Limpa a lista após a mesclagem
      // Limpa também a pré-visualização
      const pdfPreview = document.getElementById("pdfPreview");
      if (pdfPreview) {
        pdfPreview.src = "";
      }
    });
    groupContainer.appendChild(downloadBtn);
  }

  showFeedback("Os PDFs e imagens foram combinados com sucesso!", "success");
}

// Função para pré-visualizar o PDF mesclado (é chamada automaticamente em caso de alteração)
async function previewMergedPDF() {
  const pdfPreview = document.getElementById("pdfPreview");

  // Se não houver arquivos, limpa a pré-visualização e retorna
  if (allFiles.length === 0) {
    if (pdfPreview) {
      pdfPreview.src = "";
    }
    return;
  }

  try {
    // Cria um novo documento PDF para a mesclagem
    const mergedPdf = await PDFLib.PDFDocument.create();

    // Itera sobre os arquivos selecionados e os mescla
    for (const fileObj of allFiles) {
      const arrayBuffer = await fileObj.file.arrayBuffer();
      const fileType = fileObj.file.type;

      if (fileType === "application/pdf") {
        // Carrega o PDF e copia suas páginas
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } else if (fileType === "image/png" || fileType === "image/jpeg") {
        // Incorpora a imagem e cria uma página para exibi-la
        const image = fileType === "image/png" 
          ? await mergedPdf.embedPng(arrayBuffer)
          : await mergedPdf.embedJpg(arrayBuffer);

        const page = mergedPdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      } else {
        showFeedback(`Formato inválido: ${fileObj.name}`, "error");
        return;
      }
    }

    // Gera os bytes do PDF mesclado e cria um Blob
    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // Atualiza a pré-visualização no elemento <iframe id="pdfPreview">
    if (pdfPreview) {
      pdfPreview.src = url;
    }

    showFeedback("Pré-visualização atualizada com sucesso!", "success");
  } catch (err) {
    showFeedback("Erro ao gerar pré-visualização.", "error");
    console.error(err);
  }
}

// Funções utilitárias para feedback
function showFeedback(message, type = "info") {
  clearFeedback();
  const feedback = document.createElement("div");
  feedback.classList.add("feedback", type);
  feedback.textContent = message;
  feedbackContainer.appendChild(feedback);
}

function clearFeedback() {
  feedbackContainer.innerHTML = "";
}
