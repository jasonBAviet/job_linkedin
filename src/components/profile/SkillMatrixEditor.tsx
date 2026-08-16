"use client";

import React, { useState } from "react";
import { Plus, Trash2, Sparkles, Save, FileUp } from "lucide-react";
import { CandidateProfile, CandidateSkill } from "@/core/dtos/profile.dto";

interface SkillMatrixEditorProps {
  profile: CandidateProfile;
  onSave: (updatedProfile: CandidateProfile) => void;
  onExtractFromCV: (cvText: string) => Promise<void>;
  isExtracting?: boolean;
}

export const SkillMatrixEditor: React.FC<SkillMatrixEditorProps> = ({
  profile,
  onSave,
  onExtractFromCV,
  isExtracting = false,
}) => {
  const [skills, setSkills] = useState<CandidateSkill[]>(profile.skills || []);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState<CandidateSkill["category"]>("CORE");
  const [cvText, setCvText] = useState(profile.rawResumeText || "");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleProficiencyChange = (index: number, level: 1 | 2 | 3 | 4 | 5) => {
    const updated = [...skills];
    updated[index].proficiencyLevel = level;
    setSkills(updated);
  };

  const handleRemoveSkill = (index: number) => {
    const updated = skills.filter((_, idx) => idx !== index);
    setSkills(updated);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    const exists = skills.some((s) => s.name.toLowerCase() === newSkillName.toLowerCase().trim());
    if (exists) return;

    const newSkill: CandidateSkill = {
      name: newSkillName.trim(),
      category: newSkillCategory,
      proficiencyLevel: 5,
      yearsOfExperience: 3,
    };

    setSkills([newSkill, ...skills]);
    setNewSkillName("");
  };

  const handleSaveAll = () => {
    onSave({
      ...profile,
      skills,
      rawResumeText: cvText,
      lastUpdated: new Date().toISOString(),
    });
    setSaveMessage("Đã lưu ma trận kỹ năng!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleParseCV = async () => {
    if (!cvText.trim()) return;
    await onExtractFromCV(cvText);
  };

  return (
    <div className="space-y-4">
      {/* CV Quick Parser Section */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Trích Xuất Kỹ Năng Tự Động Từ CV
            </h3>
          </div>
          <span className="text-[11px] font-mono text-indigo-400">Chuẩn BABOK v3</span>
        </div>

        <textarea
          rows={3}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          placeholder="Dán nội dung CV (kinh nghiệm làm việc, công nghệ, dự án) vào đây..."
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
        />

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleParseCV}
            disabled={isExtracting || !cvText.trim()}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>{isExtracting ? "Đang trích xuất..." : "Bóc Tách Kỹ Năng Tự Động"}</span>
          </button>
        </div>
      </div>

      {/* Skills Matrix Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Ma Trận Kỹ Năng Chuyên Môn ({skills.length})
            </h3>
            <p className="text-[11px] text-slate-500">Mức thành thạo từ 1 (Cơ bản) đến 5 (Chuyên gia Senior)</p>
          </div>

          <div className="flex items-center gap-2">
            {saveMessage && <span className="text-xs font-mono text-emerald-400">{saveMessage}</span>}
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-xs font-mono font-bold text-white transition-colors"
            >
              <Save className="h-3.5 w-3.5 text-emerald-400" />
              <span>Lưu Kỹ Năng</span>
            </button>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={handleAddSkill} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Thêm kỹ năng mới (ví dụ: BABOK, DAX, BPMN 2.0...)"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <select
            value={newSkillCategory}
            onChange={(e) => setNewSkillCategory(e.target.value as any)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="CORE">Kỹ năng Cốt lõi</option>
            <option value="TOOL">Công cụ / Phần mềm</option>
            <option value="DOMAIN">Nghiệp vụ Chuyên ngành</option>
            <option value="SOFT_SKILL">Kỹ năng Mềm</option>
          </select>
          <button
            type="submit"
            className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-xs text-indigo-400 font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm</span>
          </button>
        </form>

        {/* Skills list */}
        <div className="divide-y divide-slate-800/80 max-h-[360px] overflow-y-auto">
          {skills.map((skill, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-semibold text-slate-200 truncate">{skill.name}</span>
                <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-800">
                  {skill.category}
                </span>
              </div>

              {/* 1 - 5 rating */}
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleProficiencyChange(idx, lvl as any)}
                    className={`h-6 w-6 rounded font-mono font-bold text-[11px] transition-all ${
                      skill.proficiencyLevel >= lvl
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-950 text-slate-600 hover:bg-slate-800"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleRemoveSkill(idx)}
                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                title="Xóa kỹ năng này"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
