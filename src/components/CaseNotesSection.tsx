import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Star, Send, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CaseNote {
  id: string;
  case_id: string;
  author_id: string;
  note_text: string;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url?: string;
  };
}

interface CaseNotesSectionProps {
  caseId: string;
  userId: string;
}

export const CaseNotesSection: React.FC<CaseNotesSectionProps> = ({ caseId, userId }) => {
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    loadNotes();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`case-notes-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_notes',
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          loadNotes();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [caseId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_notes')
        .select(`
          *,
          author:profiles!author_id(username, avatar_url)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase.from('case_notes').insert({
        case_id: caseId,
        author_id: userId,
        note_text: newNote.trim(),
        is_important: isImportant,
      });

      if (error) throw error;

      setNewNote('');
      setIsImportant(false);
      alert('✅ Note added successfully!');
    } catch (error) {
      console.error('Error submitting note:', error);
      alert('❌ Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editingText.trim()) return;

    try {
      const { error } = await supabase
        .from('case_notes')
        .update({ note_text: editingText.trim() })
        .eq('id', noteId);

      if (error) throw error;

      setEditingNoteId(null);
      setEditingText('');
      alert('✅ Note updated!');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('❌ Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase.from('case_notes').delete().eq('id', noteId);

      if (error) throw error;
      alert('✅ Note deleted!');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('❌ Failed to delete note');
    }
  };

  const handleToggleImportant = async (noteId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('case_notes')
        .update({ is_important: !currentValue })
        .eq('id', noteId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling important:', error);
      alert('❌ Failed to update importance');
    }
  };

  if (loading) {
    return (
      <div className="border-t border-mystery-700 pt-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-mystery-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-mystery-700 pt-6">
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Investigation Notes
          <span className="text-sm font-normal text-gray-500">(Team Only)</span>
        </h3>

        {/* Add Note Form */}
        <form onSubmit={handleSubmitNote} className="mb-6">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a private note for your team..."
            rows={3}
            className="w-full px-4 py-3 bg-mystery-900 border border-mystery-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-500 resize-none"
            disabled={submitting}
          />
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
                className="w-4 h-4 rounded border-mystery-600 bg-mystery-700 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                disabled={submitting}
              />
              <Star className="w-4 h-4 text-yellow-500" />
              Mark as important
            </label>
            <button
              type="submit"
              disabled={submitting || !newNote.trim()}
              className="px-6 py-2 bg-mystery-600 hover:bg-mystery-500 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No investigation notes yet. Add the first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`bg-mystery-900 rounded-lg p-4 border ${
                  note.is_important ? 'border-yellow-500/50' : 'border-mystery-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {note.author?.avatar_url ? (
                      <img
                        src={note.author.avatar_url}
                        alt={note.author.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-mystery-700 rounded-full flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{note.author?.username}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {note.is_important && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  {note.author_id === userId && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleImportant(note.id, note.is_important)}
                        className="text-yellow-500 hover:text-yellow-400 transition-colors"
                        title="Toggle important"
                      >
                        <Star className={`w-4 h-4 ${note.is_important ? 'fill-yellow-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingText(note.note_text);
                        }}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingNoteId === note.id ? (
                  <div className="mt-3">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mystery-500 resize-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleEditNote(note.id)}
                        className="px-4 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingNoteId(null);
                          setEditingText('');
                        }}
                        className="px-4 py-1 bg-mystery-700 hover:bg-mystery-600 text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-300 whitespace-pre-wrap">{note.note_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
