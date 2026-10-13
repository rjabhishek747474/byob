'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Smartphone,
  Monitor,
  Eye,
  Save,
  Send,
  History,
  Copy,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  AlertCircle,
  CheckCircle,
  Layout,
  Layers,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  Block,
  BlockType,
  ALLOWED_BLOCK_TYPES,
  MAX_PAGE_BLOCKS,
} from '@/modules/pages/blocks/schemas';
import { BLOCK_REGISTRY, createDefaultBlock } from '@/modules/pages/blocks/registry';
import { RenderBlock } from '@/components/store/blocks';

// Sample templates
const TEMPLATES: Record<string, { name: string; blocks: BlockType[] }> = {
  modern_store: {
    name: 'Modern E-commerce Homepage',
    blocks: [
      'announcement-bar',
      'header-nav',
      'hero',
      'benefits-row',
      'category-grid',
      'product-grid',
      'promotional-strip',
      'testimonials',
      'newsletter-capture',
      'footer',
    ],
  },
  minimalist_landing: {
    name: 'Minimalist Product Drop',
    blocks: [
      'announcement-bar',
      'header-nav',
      'hero',
      'featured-product',
      'image-with-text',
      'faq-accordion',
      'footer',
    ],
  },
};

/**
 * Sortable Block Item wrapper for dnd-kit canvas
 */
function SortableBlockItem({
  block,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const blockDef = BLOCK_REGISTRY[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`group relative mb-4 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-blue-600 ring-4 ring-blue-500/10 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      {/* Block Floating Action Toolbar */}
      <div className="absolute -top-3 left-4 right-4 z-30 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-900 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow flex items-center gap-1.5 pointer-events-auto">
          <span>{blockDef?.title || block.type}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded shadow-md flex items-center overflow-hidden divide-x divide-gray-100 pointer-events-auto">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="p-1.5 hover:bg-gray-100 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-900"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Accessible Reorder Up */}
          <button
            disabled={isFirst}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            className="p-1.5 hover:bg-gray-100 disabled:opacity-30 text-gray-600 hover:text-gray-900"
            title="Move block up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Accessible Reorder Down */}
          <button
            disabled={isLast}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            className="p-1.5 hover:bg-gray-100 disabled:opacity-30 text-gray-600 hover:text-gray-900"
            title="Move block down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            title="Duplicate block"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Actual Block Renderer in Canvas */}
      <div className="pointer-events-none select-none overflow-hidden rounded-lg">
        <RenderBlock block={block} />
      </div>
    </div>
  );
}

/**
 * Visual Drag-and-Drop Page Builder Main Component
 */
export default function VisualPageBuilder() {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [blocks, setBlocks] = useState<Block[]>(() =>
    TEMPLATES.modern_store.blocks.map((type, idx) =>
      createDefaultBlock(type, `init-${idx}`)
    )
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    'init-0-announcement-bar'
  );
  const [activeTab, setActiveTab] = useState<'library' | 'templates'>('library');
  const [pageSlug, setPageSlug] = useState('home');
  const [pageId, setPageId] = useState('page-home');
  const [versionNumber, setVersionNumber] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  // Handle Drag & Drop reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Keyboard reordering helper
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    setBlocks((items) => arrayMove(items, index, targetIndex));
  };

  // Add block from library
  const handleAddBlock = (type: BlockType) => {
    if (blocks.length >= MAX_PAGE_BLOCKS) {
      alert(`Max block limit of ${MAX_PAGE_BLOCKS} reached.`);
      return;
    }
    const newBlock = createDefaultBlock(type);
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  // Duplicate block
  const handleDuplicateBlock = (id: string) => {
    if (blocks.length >= MAX_PAGE_BLOCKS) {
      alert(`Max block limit of ${MAX_PAGE_BLOCKS} reached.`);
      return;
    }
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const target = blocks[index];
    const clone: Block = {
      ...target,
      id: `${target.id}-copy-${blocks.length + 1}`,
      props: JSON.parse(JSON.stringify(target.props)),
    } as Block;

    const updated = [...blocks];
    updated.splice(index + 1, 0, clone);
    setBlocks(updated);
    setSelectedBlockId(clone.id);
  };

  // Delete block
  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  // Update selected block props
  const updateSelectedBlockProps = (key: string, value: unknown) => {
    if (!selectedBlockId) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== selectedBlockId) return b;
        return {
          ...b,
          props: {
            ...b.props,
            [key]: value,
          },
        } as Block;
      })
    );
  };

  // Apply template
  const handleApplyTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    if (!template) return;
    if (confirm(`Replace all canvas blocks with "${template.name}"?`)) {
      const templateBlocks = template.blocks.map((t, idx) =>
        createDefaultBlock(t, `tmpl-${idx}`)
      );
      setBlocks(templateBlocks);
      setSelectedBlockId(templateBlocks[0]?.id || null);
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setStatusMessage('Saving draft...');
    setTimeout(() => {
      setStatusMessage('Draft saved successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    }, 400);
  };

  // Publish
  const handlePublish = async () => {
    const errors: string[] = [];

    // Max blocks check
    if (blocks.length > MAX_PAGE_BLOCKS) {
      errors.push(`Block count (${blocks.length}) exceeds maximum limit of ${MAX_PAGE_BLOCKS}.`);
    }

    // Required fields check
    for (const block of blocks) {
      const props = block.props as Record<string, unknown>;
      if (block.type === 'hero' && !props.heading) {
        errors.push(`Hero block (${block.id}) is missing a heading.`);
      }
      if (block.type === 'featured-product' && !props.productId) {
        errors.push(`Featured product block (${block.id}) requires a product ID.`);
      }

      // CTA check
      if (typeof props.ctaHref === 'string') {
        const lower = props.ctaHref.toLowerCase();
        if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) {
          errors.push(`Block (${block.id}) contains forbidden JavaScript protocol in CTA link.`);
        }
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsPublishModalOpen(true);
      return;
    }

    setVersionNumber((v) => v + 1);
    setStatusMessage('Page published successfully to storefront!');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Rollback
  const handleRollback = () => {
    if (versionNumber <= 1) {
      alert('No earlier version available for rollback.');
      return;
    }
    if (confirm(`Rollback to version ${versionNumber - 1}?`)) {
      setVersionNumber((v) => v - 1);
      setStatusMessage(`Rolled back to version ${versionNumber - 1}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-100 overflow-hidden">
      {/* TOP BAR */}
      <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">Page:</span>
            <select
              value={pageSlug}
              onChange={(e) => setPageSlug(e.target.value)}
              className="text-sm font-semibold bg-gray-50 border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="home">Home (/) </option>
              <option value="about">About Us (/about)</option>
              <option value="terms">Terms (/terms)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Version:</span>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              v{versionNumber}
            </span>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 animate-fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Viewport & Actions */}
        <div className="flex items-center gap-3">
          {/* Viewport Toggles */}
          <div className="bg-gray-100 p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                viewport === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Desktop Viewport (100%)"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                viewport === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Mobile Viewport (375px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              previewMode ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Edit Mode' : 'Preview'}</span>
          </button>

          {/* Rollback */}
          <button
            onClick={handleRollback}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            title="Rollback to earlier version"
          >
            <History className="w-3.5 h-3.5" />
            <span>Rollback</span>
          </button>

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* THREE-PANEL BUILDER BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Block Library & Templates */}
        {!previewMode && (
          <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
            {/* Tab switch */}
            <div className="flex border-b border-gray-200 p-2 gap-1 bg-gray-50">
              <button
                onClick={() => setActiveTab('library')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'library'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Blocks (15)</span>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'templates'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Templates</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeTab === 'library' ? (
                <>
                  <p className="text-xs text-gray-500 font-medium mb-2">
                    Click to append blocks to your canvas:
                  </p>
                  {ALLOWED_BLOCK_TYPES.map((type) => {
                    const def = BLOCK_REGISTRY[type];
                    return (
                      <button
                        key={type}
                        onClick={() => handleAddBlock(type)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all group flex items-start justify-between"
                      >
                        <div>
                          <p className="font-semibold text-xs text-gray-900 group-hover:text-blue-600">
                            {def?.title || type}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                            {def?.description}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 font-medium mb-2">
                    Select a curated starter layout:
                  </p>
                  {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                    <div
                      key={key}
                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-500 transition-colors"
                    >
                      <h4 className="font-bold text-xs text-gray-900">{tmpl.name}</h4>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Includes {tmpl.blocks.length} pre-configured blocks
                      </p>
                      <button
                        onClick={() => handleApplyTemplate(key as keyof typeof TEMPLATES)}
                        className="mt-3 w-full py-1.5 bg-gray-900 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Apply Template
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        )}

        {/* CENTER PANEL: Sortable Canvas */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-gray-100">
          <div
            className={`w-full transition-all duration-300 ${
              viewport === 'mobile'
                ? 'max-w-[375px] border-[12px] border-gray-800 rounded-[3rem] shadow-2xl bg-white min-h-[667px] my-6'
                : 'max-w-5xl bg-transparent'
            }`}
          >
            {blocks.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-gray-900">Your canvas is empty</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Add blocks from the library on the left to start building.
                </p>
              </div>
            ) : previewMode ? (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                {blocks.map((block) => (
                  <RenderBlock key={block.id} block={block} />
                ))}
              </div>
            ) : (
              <DndContext
                id="visual-page-builder-canvas"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {blocks.map((block, index) => (
                    <SortableBlockItem
                      key={block.id}
                      block={block}
                      isSelected={block.id === selectedBlockId}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onDuplicate={() => handleDuplicateBlock(block.id)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onMoveUp={() => moveBlock(index, 'up')}
                      onMoveDown={() => moveBlock(index, 'down')}
                      isFirst={index === 0}
                      isLast={index === blocks.length - 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </main>

        {/* RIGHT PANEL: Block Properties Editor */}
        {!previewMode && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 z-10">
            <div className="h-12 border-b border-gray-200 px-4 flex items-center gap-2 bg-gray-50">
              <Settings2 className="w-4 h-4 text-gray-600" />
              <span className="font-bold text-xs text-gray-900">Block Properties</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedBlock ? (
                <div className="space-y-4">
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                    <p className="text-xs font-bold text-blue-900">
                      {BLOCK_REGISTRY[selectedBlock.type]?.title || selectedBlock.type}
                    </p>
                    <p className="text-[10px] text-blue-700/80 mt-0.5">
                      ID: {selectedBlock.id}
                    </p>
                  </div>

                  {/* Dynamic inputs based on block props */}
                  {Object.entries(selectedBlock.props).map(([propKey, propVal]) => {
                    if (typeof propVal === 'string') {
                      if (propKey.includes('Color') || propKey.includes('color')) {
                        return (
                          <div key={propKey}>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 capitalize">
                              {propKey}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={propVal}
                                onChange={(e) => updateSelectedBlockProps(propKey, e.target.value)}
                                className="w-8 h-8 rounded border p-0.5 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={propVal}
                                onChange={(e) => updateSelectedBlockProps(propKey, e.target.value)}
                                className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded font-mono"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={propKey}>
                          <label className="block text-xs font-semibold text-gray-700 mb-1 capitalize">
                            {propKey}
                          </label>
                          <textarea
                            rows={propVal.length > 50 ? 3 : 1}
                            value={propVal}
                            onChange={(e) => updateSelectedBlockProps(propKey, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    }

                    if (typeof propVal === 'boolean') {
                      return (
                        <div key={propKey} className="flex items-center justify-between py-1">
                          <label className="text-xs font-semibold text-gray-700 capitalize">
                            {propKey}
                          </label>
                          <input
                            type="checkbox"
                            checked={propVal}
                            onChange={(e) => updateSelectedBlockProps(propKey, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-xs">Select any block on the canvas to configure its settings.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Validation Errors Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-3">
              <AlertCircle className="w-5 h-5" />
              <h3>Publish Validation Failed</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              The following issues must be resolved before publishing to the live storefront:
            </p>
            <ul className="space-y-2 mb-6">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                  {err}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
              >
                Close & Fix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
