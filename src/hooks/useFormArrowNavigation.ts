import { useEffect } from 'react';

/**
 * Helper to check cursor positions inside text/number inputs.
 */
const getInputCursorEdges = (el: HTMLElement) => {
  let isAtStart = true;
  let isAtEnd = true;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const input = el as HTMLInputElement;
    const originalType = input.type;
    const isSpecialType = originalType === 'number';

    try {
      // Temporarily change type for number inputs to safely read selection details
      if (isSpecialType) {
        input.type = 'text';
      }
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const valLength = input.value.length;
      if (start !== null && end !== null) {
        isAtStart = start === 0;
        isAtEnd = end === valLength;
      }
    } catch (err) {
      // Fallback in case of browser restrictions
    } finally {
      if (isSpecialType) {
        input.type = originalType;
      }
    }
  }

  return { isAtStart, isAtEnd };
};

/**
 * Hook to enable left/right arrow and Enter navigation between logical form fields.
 * 
 * @param formRef Ref pointing to the form or wrapper element.
 * @param enabled Whether arrow/enter navigation is active.
 */
export const useFormArrowNavigation = (
  formRef: React.RefObject<HTMLFormElement | HTMLDivElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!enabled) return;

    const focusAndSelect = (el: HTMLElement) => {
      el.focus({ preventScroll: false });
      if (el instanceof HTMLInputElement) {
        const type = el.type;
        if (
          type === 'text' ||
          type === 'number' ||
          type === 'email' ||
          type === 'tel' ||
          type === 'search' ||
          type === 'url'
        ) {
          setTimeout(() => {
            try {
              el.select();
            } catch (err) {
              // Fail silently
            }
          }, 50);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isLeft = e.key === 'ArrowLeft';
      const isRight = e.key === 'ArrowRight';
      const isEnter = e.key === 'Enter';
      const isTab = e.key === 'Tab';

      if (!isLeft && !isRight && !isEnter && !isTab) return;

      const form = formRef.current;
      if (!form) return;

      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement || !form.contains(activeElement)) return;

      // Helper to dynamically get focusable fields in correct visible DOM order
      const getFocusableElements = () => {
        const allElements = Array.from(
          form.querySelectorAll<HTMLElement>(
            'input, select, textarea, button, [tabindex]'
          )
        );
        return allElements.filter(el => {
          if (el.tabIndex === -1) return false;

          const inputEl = el as HTMLInputElement;
          if (inputEl.disabled) return false;
          if (inputEl.type === 'hidden') return false;

          // Verify visibility in DOM
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return false;
          
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;

          return true;
        });
      };

      if (isTab) {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(activeElement);
        if (currentIndex === -1) return;

        if (e.shiftKey) {
          // Shift + Tab: loop back to last element if currently at first
          if (currentIndex === 0) {
            e.preventDefault();
            focusAndSelect(focusable[focusable.length - 1]);
          }
        } else {
          // Tab: loop back to first element if currently at last
          if (currentIndex === focusable.length - 1) {
            e.preventDefault();
            focusAndSelect(focusable[0]);
          }
        }
        return;
      }

      // Do not interfere with textarea
      if (activeElement.tagName.toLowerCase() === 'textarea') {
        return;
      }

      // Check if dropdown option navigation is active (dropdown is open)
      const isDropdownOpen = 
        activeElement.getAttribute('aria-expanded') === 'true' || 
        !!document.querySelector('[role="listbox"]');

      // Check if date picker calendar is open
      const isCalendarOpen = !!document.querySelector('.CustomCalendar');
      if (isCalendarOpen) return;

      if (isLeft || isRight) {
        const { isAtStart, isAtEnd } = getInputCursorEdges(activeElement);
        if (isLeft && !isAtStart) return;
        if (isRight && !isAtEnd) return;

        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        if (isRight) {
          nextIndex = (currentIndex + 1) % focusable.length;
        } else if (isLeft) {
          nextIndex = (currentIndex - 1 + focusable.length) % focusable.length;
        }

        if (nextIndex !== currentIndex) {
          e.preventDefault();
          focusAndSelect(focusable[nextIndex]);
        }
      } else if (isEnter) {
        // Let any button trigger its normal click handler when focused
        if (activeElement.tagName.toLowerCase() === 'button') {
          return;
        }

        // If searchable dropdown is open, let Enter select the option first, then focus next
        if (isDropdownOpen) {
          // Do not call preventDefault here so the SearchableSelect keydown handler can run handleSelect()
          setTimeout(() => {
            const focusable = getFocusableElements();
            const currIndex = focusable.indexOf(activeElement);
            if (currIndex !== -1 && focusable.length > 0) {
              const nextIndex = (currIndex + 1) % focusable.length;
              focusAndSelect(focusable[nextIndex]);
            }
          }, 50);
          return;
        }

        // If focused on checkbox, trigger click (to update state) and shift focus dynamically
        if (activeElement instanceof HTMLInputElement && activeElement.type === 'checkbox') {
          e.preventDefault();
          activeElement.click();
          setTimeout(() => {
            const focusable = getFocusableElements();
            const currIndex = focusable.indexOf(activeElement);
            if (currIndex !== -1 && focusable.length > 0) {
              const nextIndex = (currIndex + 1) % focusable.length;
              focusAndSelect(focusable[nextIndex]);
            }
          }, 50);
          return;
        }

        // For text inputs and closed dropdowns, shift focus immediately
        e.preventDefault();
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(activeElement);
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % focusable.length;
        focusAndSelect(focusable[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [formRef, enabled]);
};
