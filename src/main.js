import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import './style.css';

const panoramaBaseUrl = `${import.meta.env.BASE_URL}panoramas`;

const scenes = Array.from({ length: 8 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const needsHalfTurn = index >= 2 && index <= 5;

  return {
    name: `拍攝點 ${number}`,
    panorama: `${panoramaBaseUrl}/library-${number}.jpg`,
    sphereCorrection: {
      pan: needsHalfTurn ? '180deg' : '0deg',
    },
  };
});

const viewerContainer = document.querySelector('#viewer');
const currentSceneElement = document.querySelector('#current-scene');
const sceneCounterElement = document.querySelector('#scene-counter');
const previousSceneButton = document.querySelector('#previous-scene');
const previousSceneLabel = document.querySelector('#previous-scene-label');
const nextSceneButton = document.querySelector('#next-scene');
const nextSceneLabel = document.querySelector('#next-scene-label');
const annotationModeButton = document.querySelector('#annotation-mode');
const clearAnnotationsButton = document.querySelector('#clear-annotations');
const annotationPlacementHint = document.querySelector('#annotation-placement-hint');
const annotationEditor = document.querySelector('#annotation-editor');
const annotationForm = document.querySelector('#annotation-form');
const annotationEditorTitle = document.querySelector('#annotation-editor-title');
const annotationTextInput = document.querySelector('#annotation-text');
const annotationSaveButton = document.querySelector('#annotation-save');
const annotationDeleteButton = document.querySelector('#annotation-delete');
const annotationCancelButton = document.querySelector('#annotation-cancel');

if (
  !viewerContainer
  || !currentSceneElement
  || !sceneCounterElement
  || !previousSceneButton
  || !previousSceneLabel
  || !nextSceneButton
  || !nextSceneLabel
  || !annotationModeButton
  || !clearAnnotationsButton
  || !annotationPlacementHint
  || !annotationEditor
  || !annotationForm
  || !annotationEditorTitle
  || !annotationTextInput
  || !annotationSaveButton
  || !annotationDeleteButton
  || !annotationCancelButton
) {
  throw new Error('找不到全景導覽所需的頁面元件');
}

const annotationsByScene = scenes.map(() => []);

let currentSceneIndex = 0;
let isChangingScene = false;
let isAnnotationPlacementMode = false;
let pendingAnnotationPosition = null;
let editingAnnotationId = null;
let annotationIdCounter = 0;

const viewer = new Viewer({
  container: viewerContainer,
  panorama: scenes[currentSceneIndex].panorama,
  caption: `圖書館全景導覽－${scenes[currentSceneIndex].name}`,
  sphereCorrection: scenes[currentSceneIndex].sphereCorrection,
  defaultYaw: '0deg',
  defaultPitch: '0deg',
  defaultZoomLvl: 20,
  navbar: ['zoom', 'move', 'fullscreen'],
  plugins: [
    MarkersPlugin.withConfig({
      clickEventOnMarker: false,
      defaultHoverScale: {
        amount: 1.08,
        duration: 120,
        easing: 'ease-out',
      },
    }),
  ],
  mousemove: true,
  mousewheel: true,
  mousewheelCtrlKey: false,
  touchmoveTwoFingers: false,
  keyboard: 'always',
  lang: {
    zoom: '縮放',
    zoomOut: '縮小',
    zoomIn: '放大',
    moveUp: '向上',
    moveDown: '向下',
    moveLeft: '向左',
    moveRight: '向右',
    fullscreen: '全螢幕',
    loading: '全景照片載入中……',
    loadError: '無法載入全景照片',
    webglError: '此瀏覽器不支援 WebGL',
  },
});

const markersPlugin = viewer.getPlugin(MarkersPlugin);

function getNextSceneIndex(index) {
  return (index + 1) % scenes.length;
}

function getPreviousSceneIndex(index) {
  return (index - 1 + scenes.length) % scenes.length;
}

function getTotalAnnotationCount() {
  return annotationsByScene.reduce((total, annotations) => total + annotations.length, 0);
}

function updateTourInterface() {
  const currentScene = scenes[currentSceneIndex];
  const nextScene = scenes[getNextSceneIndex(currentSceneIndex)];
  const previousScene = scenes[getPreviousSceneIndex(currentSceneIndex)];
  const currentNumber = String(currentSceneIndex + 1).padStart(2, '0');
  const totalNumber = String(scenes.length).padStart(2, '0');

  currentSceneElement.textContent = currentScene.name;
  sceneCounterElement.textContent = `${currentNumber} / ${totalNumber}`;
  previousSceneLabel.textContent = `返回${previousScene.name}`;
  previousSceneButton.setAttribute('aria-label', `上一個地點：${previousScene.name}`);
  nextSceneLabel.textContent = `前往${nextScene.name}`;
  nextSceneButton.setAttribute('aria-label', `前往${nextScene.name}`);
}

function updateAnnotationToolbar() {
  const count = getTotalAnnotationCount();

  clearAnnotationsButton.disabled = count === 0;
  clearAnnotationsButton.setAttribute(
    'aria-label',
    count === 0 ? '目前沒有臨時文字' : `清除全部 ${count} 個臨時文字`,
  );
}

function createAnnotationElement(annotation) {
  const element = document.createElement('button');
  const text = document.createElement('span');
  const editHint = document.createElement('span');

  element.type = 'button';
  element.className = 'tour-annotation-marker';
  element.setAttribute('aria-label', `${annotation.text}，點擊可修改或刪除`);

  text.className = 'tour-annotation-marker__text';
  text.textContent = annotation.text;

  editHint.className = 'tour-annotation-marker__edit-hint';
  editHint.textContent = '點擊編輯';
  editHint.setAttribute('aria-hidden', 'true');

  element.append(text, editHint);
  return element;
}

function createMarkerConfig(annotation) {
  return {
    id: annotation.id,
    position: annotation.position,
    element: createAnnotationElement(annotation),
    anchor: 'bottom center',
    data: {
      annotationId: annotation.id,
    },
    zIndex: 5,
  };
}

function renderSceneAnnotations() {
  const markerConfigs = annotationsByScene[currentSceneIndex].map(createMarkerConfig);

  markersPlugin.setMarkers(markerConfigs);
  updateAnnotationToolbar();
}

function setAnnotationPlacementMode(enabled) {
  const nextState = Boolean(enabled) && !isChangingScene;

  isAnnotationPlacementMode = nextState;
  viewerContainer.classList.toggle('is-annotating', nextState);
  annotationModeButton.classList.toggle('is-active', nextState);
  annotationModeButton.setAttribute('aria-pressed', String(nextState));
  annotationPlacementHint.hidden = !nextState;
}

function getCurrentAnnotation(annotationId) {
  return annotationsByScene[currentSceneIndex].find(
    (annotation) => annotation.id === annotationId,
  );
}

function openAnnotationEditor({ annotation = null, position = null } = {}) {
  if (annotationEditor.open) {
    annotationEditor.close();
  }

  editingAnnotationId = annotation?.id ?? null;
  pendingAnnotationPosition = position;
  annotationEditorTitle.textContent = annotation ? '修改書櫃介紹' : '新增書櫃介紹';
  annotationTextInput.value = annotation?.text ?? '';
  annotationTextInput.setCustomValidity('');
  annotationSaveButton.textContent = annotation ? '儲存修改' : '放到全景';
  annotationDeleteButton.hidden = !annotation;

  viewer.stopKeyboardControl();
  annotationEditor.showModal();
  window.setTimeout(() => annotationTextInput.focus(), 0);
}

function closeAnnotationEditor() {
  if (annotationEditor.open) {
    annotationEditor.close();
  }
}

function resetAnnotationEditorState() {
  editingAnnotationId = null;
  pendingAnnotationPosition = null;
  annotationTextInput.value = '';
  annotationTextInput.setCustomValidity('');
  viewer.startKeyboardControl();
}

async function changeScene(nextSceneIndex, activeButton) {
  if (isChangingScene) {
    return;
  }

  const nextScene = scenes[nextSceneIndex];

  setAnnotationPlacementMode(false);
  closeAnnotationEditor();
  markersPlugin.clearMarkers();

  isChangingScene = true;
  nextSceneButton.disabled = true;
  previousSceneButton.disabled = true;
  annotationModeButton.disabled = true;
  activeButton.classList.add('is-loading');
  viewerContainer.setAttribute('aria-busy', 'true');

  try {
    const panoramaChanged = await viewer.setPanorama(nextScene.panorama, {
      caption: `圖書館全景導覽－${nextScene.name}`,
      sphereCorrection: nextScene.sphereCorrection,
      transition: {
        effect: 'fade',
        speed: 700,
      },
    });

    if (panoramaChanged) {
      currentSceneIndex = nextSceneIndex;
      updateTourInterface();
    }
  } catch (error) {
    console.error(`無法切換至${nextScene.name}`, error);
  } finally {
    isChangingScene = false;
    nextSceneButton.disabled = false;
    previousSceneButton.disabled = false;
    annotationModeButton.disabled = false;
    activeButton.classList.remove('is-loading');
    viewerContainer.removeAttribute('aria-busy');
    renderSceneAnnotations();
  }
}

annotationModeButton.addEventListener('click', () => {
  setAnnotationPlacementMode(!isAnnotationPlacementMode);
});

clearAnnotationsButton.addEventListener('click', () => {
  const count = getTotalAnnotationCount();

  if (count === 0) {
    return;
  }

  const shouldClear = window.confirm(`確定要清除全部 ${count} 個臨時文字嗎？`);

  if (!shouldClear) {
    return;
  }

  annotationsByScene.forEach((annotations) => {
    annotations.length = 0;
  });
  annotationIdCounter = 0;
  renderSceneAnnotations();
});

viewer.addEventListener('click', ({ data }) => {
  if (!isAnnotationPlacementMode || data.rightclick) {
    return;
  }

  const position = Number.isFinite(data.textureX) && Number.isFinite(data.textureY)
    ? {
        textureX: data.textureX,
        textureY: data.textureY,
      }
    : {
        yaw: data.yaw,
        pitch: data.pitch,
      };

  setAnnotationPlacementMode(false);
  openAnnotationEditor({ position });
});

markersPlugin.addEventListener('select-marker', ({ marker }) => {
  const annotation = getCurrentAnnotation(marker.data?.annotationId);

  if (!annotation) {
    return;
  }

  setAnnotationPlacementMode(false);
  openAnnotationEditor({ annotation });
});

annotationForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = annotationTextInput.value.trim();

  if (!text) {
    annotationTextInput.setCustomValidity('請輸入要放在全景上的文字');
    annotationTextInput.reportValidity();
    return;
  }

  annotationTextInput.setCustomValidity('');

  if (editingAnnotationId) {
    const annotation = getCurrentAnnotation(editingAnnotationId);

    if (annotation) {
      annotation.text = text;
    }
  } else if (pendingAnnotationPosition) {
    annotationIdCounter += 1;
    annotationsByScene[currentSceneIndex].push({
      id: `temporary-annotation-${annotationIdCounter}`,
      text,
      position: pendingAnnotationPosition,
    });
  }

  closeAnnotationEditor();
  renderSceneAnnotations();
});

annotationTextInput.addEventListener('input', () => {
  annotationTextInput.setCustomValidity('');
});

annotationDeleteButton.addEventListener('click', () => {
  if (!editingAnnotationId) {
    return;
  }

  const annotations = annotationsByScene[currentSceneIndex];
  const annotationIndex = annotations.findIndex(
    (annotation) => annotation.id === editingAnnotationId,
  );

  if (annotationIndex !== -1) {
    annotations.splice(annotationIndex, 1);
  }

  closeAnnotationEditor();
  renderSceneAnnotations();
});

annotationCancelButton.addEventListener('click', closeAnnotationEditor);
annotationEditor.addEventListener('close', resetAnnotationEditorState);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isAnnotationPlacementMode) {
    setAnnotationPlacementMode(false);
  }

  if (
    (event.ctrlKey || event.metaKey)
    && event.key === 'Enter'
    && annotationEditor.open
  ) {
    annotationForm.requestSubmit();
  }
});

viewer.addEventListener('ready', renderSceneAnnotations, { once: true });
nextSceneButton.addEventListener('click', () => {
  changeScene(getNextSceneIndex(currentSceneIndex), nextSceneButton);
});
previousSceneButton.addEventListener('click', () => {
  changeScene(getPreviousSceneIndex(currentSceneIndex), previousSceneButton);
});
updateTourInterface();
updateAnnotationToolbar();
