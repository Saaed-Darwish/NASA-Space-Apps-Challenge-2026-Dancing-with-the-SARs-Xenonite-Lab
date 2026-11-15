from datetime import date
import unittest
import numpy as np
from prepare_forest_forecast import fit_predict


class ForestModelTests(unittest.TestCase):
    def test_signed_signal_seasonality_and_extreme_reading(self):
        dates = [date(y, m, 15) for y in range(2019, 2027) for m in range(1, 13)]
        noise = np.random.default_rng(42).normal(0, .3, len(dates))
        values = [-14 + .4*np.sin(d.month) - .02*(d.year-2019) + noise[i] for i,d in enumerate(dates)]
        values[40] -= 5
        expected,z,mean,lower,upper = fit_predict(dates,values,[date(2027,m,15) for m in range(1,13)])
        self.assertLess(z[40], -4)
        self.assertTrue(np.all(mean < 0))
        self.assertTrue(np.all(lower < mean))
        self.assertTrue(np.all(mean < upper))
        self.assertLess(abs(expected[40] - (values[40]+5)), .5)

    def test_reject_inadequate_seasonal_coverage_and_zero_residual_scale(self):
        with self.assertRaises(ValueError):
            fit_predict([date(2020,5,15)]*30, [-14]*30, [date(2027,5,15)])
        dates = [date(y,m,15) for y in range(2019,2027) for m in range(1,13)]
        with self.assertRaises(ValueError):
            fit_predict(dates,[-14]*len(dates),[date(2027,1,15)])
