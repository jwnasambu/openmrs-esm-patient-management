import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { omrsDateFormat } from '../constants';
import { useAppointmentsCalendar } from '../hooks/useAppointmentsCalendar';
import { SelectedDateContextProvider } from '../hooks/selected-date-context';
import AppointmentsHeader from '../header/appointments-header.component';
import CalendarHeader from './header/calendar-header.component';
import MonthlyCalendarView from './monthly/monthly-calendar-view.component';

const AppointmentsCalendarView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('day').format(omrsDateFormat));
  const { calendarEvents } = useAppointmentsCalendar(dayjs(selectedDate).toISOString(), 'monthly');

  let params = useParams();

  useEffect(() => {
    if (params.date) {
      setSelectedDate(dayjs(params.date).startOf('day').format(omrsDateFormat));
    }
  }, [params.date]);

  return (
    <SelectedDateContextProvider value={{ selectedDate, setSelectedDate }}>
      <div data-testid="appointments-calendar">
        <AppointmentsHeader title={t('calendar', 'Calendar')} />
        <CalendarHeader />
        <MonthlyCalendarView events={calendarEvents} />
      </div>
    </SelectedDateContextProvider>
  );
};

export default AppointmentsCalendarView;
